-- ============================================================
-- 0002 — Custody workflow RPCs
-- All custody mutations are SECURITY DEFINER functions so each
-- handover is atomic and permission-checked at the database level.
-- Run in the Supabase SQL editor after 0001.
-- ============================================================

-- ------------------------------------------------------------
-- initiate_transfer: start an issue / transfer / return.
-- Puts the asset into 'pending_acceptance' until the recipient responds.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initiate_transfer(
  p_asset_id UUID,
  p_type     TEXT,
  p_to       UUID DEFAULT NULL,
  p_remarks  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_staff BOOLEAN;
  v_asset RECORD;
  v_id    UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = v_actor AND role IN ('admin','asset_manager'))
    INTO v_staff;

  SELECT * INTO v_asset FROM public.assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.transfers
             WHERE asset_id = p_asset_id AND status = 'pending') THEN
    RAISE EXCEPTION 'This asset already has a pending transfer';
  END IF;

  IF p_type = 'issue' THEN
    IF NOT v_staff THEN RAISE EXCEPTION 'Only staff can issue assets'; END IF;
    IF v_asset.status <> 'in_stock' THEN
      RAISE EXCEPTION 'Asset must be in stock to issue (current status: %)', v_asset.status;
    END IF;
    IF p_to IS NULL THEN RAISE EXCEPTION 'Recipient is required'; END IF;

  ELSIF p_type = 'transfer' THEN
    IF NOT (v_staff OR v_asset.current_custodian = v_actor) THEN
      RAISE EXCEPTION 'Only staff or the current custodian can transfer this asset';
    END IF;
    IF v_asset.status <> 'assigned' THEN
      RAISE EXCEPTION 'Asset must be assigned to transfer (current status: %)', v_asset.status;
    END IF;
    IF p_to IS NULL THEN RAISE EXCEPTION 'Recipient is required'; END IF;
    IF p_to = v_asset.current_custodian THEN
      RAISE EXCEPTION 'Asset is already with this employee';
    END IF;

  ELSIF p_type = 'return' THEN
    IF NOT (v_staff OR v_asset.current_custodian = v_actor) THEN
      RAISE EXCEPTION 'Only staff or the current custodian can return this asset';
    END IF;
    IF v_asset.status <> 'assigned' THEN
      RAISE EXCEPTION 'Asset must be assigned to return (current status: %)', v_asset.status;
    END IF;
    p_to := NULL;  -- returns always go back to stock

  ELSE
    RAISE EXCEPTION 'Invalid transfer type: %', p_type;
  END IF;

  IF p_to IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM public.profiles WHERE id = p_to AND is_active) THEN
    RAISE EXCEPTION 'Recipient is not an active employee';
  END IF;

  INSERT INTO public.transfers
    (asset_id, type, from_custodian, to_custodian, initiated_by, remarks)
  VALUES
    (p_asset_id, p_type, v_asset.current_custodian, p_to, v_actor, p_remarks)
  RETURNING id INTO v_id;

  UPDATE public.assets
     SET status = 'pending_acceptance', updated_at = NOW()
   WHERE id = p_asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor, 'transfer_initiated', 'transfer', v_id,
          jsonb_build_object('asset_id', p_asset_id, 'type', p_type, 'to', p_to));

  RETURN v_id;
END; $$;

-- ------------------------------------------------------------
-- respond_transfer: reject (recipient) or cancel (initiator/staff)
-- a pending transfer. Reverts the asset to its previous state.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_transfer(
  p_transfer_id UUID,
  p_action      TEXT  -- 'reject' | 'cancel'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_staff BOOLEAN;
  t RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = v_actor AND role IN ('admin','asset_manager'))
    INTO v_staff;

  SELECT * INTO t FROM public.transfers
   WHERE id = p_transfer_id AND status = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found or no longer pending'; END IF;

  IF p_action = 'reject' THEN
    IF NOT (t.to_custodian = v_actor OR (t.type = 'return' AND v_staff)) THEN
      RAISE EXCEPTION 'Only the recipient can reject this transfer';
    END IF;
  ELSIF p_action = 'cancel' THEN
    IF NOT (t.initiated_by = v_actor OR v_staff) THEN
      RAISE EXCEPTION 'Only the initiator or staff can cancel this transfer';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  UPDATE public.transfers
     SET status = CASE p_action WHEN 'reject' THEN 'rejected' ELSE 'cancelled' END,
         responded_at = NOW()
   WHERE id = p_transfer_id;

  -- revert the asset: an unaccepted issue goes back to stock,
  -- an unaccepted transfer/return stays with its current custodian
  UPDATE public.assets
     SET status = CASE WHEN t.type = 'issue' THEN 'in_stock' ELSE 'assigned' END,
         updated_at = NOW()
   WHERE id = t.asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor,
          CASE p_action WHEN 'reject' THEN 'transfer_rejected' ELSE 'transfer_cancelled' END,
          'transfer', p_transfer_id,
          jsonb_build_object('asset_id', t.asset_id, 'type', t.type));
END; $$;

-- ------------------------------------------------------------
-- accept_transfer: hardened redefinition (replaces 0001 version).
-- Closes the open custody period, opens the new one (or returns
-- to stock), updates the asset — all in one transaction.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_transfer(p_transfer_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_staff BOOLEAN;
  t RECORD;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = v_actor AND role IN ('admin','asset_manager'))
    INTO v_staff;

  SELECT * INTO t FROM public.transfers
   WHERE id = p_transfer_id AND status = 'pending'
     AND (to_custodian = v_actor OR (type = 'return' AND v_staff))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found, not pending, or not addressed to you';
  END IF;

  UPDATE public.custody_records
     SET ended_at = NOW(),
         end_reason = CASE t.type WHEN 'return' THEN 'returned' ELSE 'transferred' END
   WHERE asset_id = t.asset_id AND ended_at IS NULL;

  IF t.type = 'return' THEN
    UPDATE public.assets
       SET current_custodian = NULL, status = 'in_stock', updated_at = NOW()
     WHERE id = t.asset_id;
  ELSE
    INSERT INTO public.custody_records (asset_id, custodian_id, issued_by)
         VALUES (t.asset_id, t.to_custodian, t.initiated_by);
    UPDATE public.assets
       SET current_custodian = t.to_custodian, status = 'assigned', updated_at = NOW()
     WHERE id = t.asset_id;
  END IF;

  UPDATE public.transfers
     SET status = 'accepted', responded_at = NOW()
   WHERE id = p_transfer_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor, 'transfer_accepted', 'transfer', p_transfer_id,
          jsonb_build_object('asset_id', t.asset_id, 'type', t.type));
END; $$;
