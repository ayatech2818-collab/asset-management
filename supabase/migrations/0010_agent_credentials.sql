-- ============================================================
-- 0010 — Per-device agent lock credentials
-- Run in the Supabase SQL editor after 0009.
--
-- The Android agent app is locked behind a username + passcode that the
-- employee does not know. Staff set them here; they ride down to the device on
-- the heartbeat response and gate the agent's UI (so the employee can't stop
-- monitoring or change the server/token). Stored readable (staff-only via the
-- existing p_enroll_staff RLS policy) so an admin can always look them up —
-- these are device-lock codes managed entirely by staff, not personal
-- account passwords.
-- ============================================================

ALTER TABLE public.device_enrollments
  ADD COLUMN IF NOT EXISTS agent_username TEXT,
  ADD COLUMN IF NOT EXISTS agent_passcode TEXT;

-- ------------------------------------------------------------
-- set_agent_credentials: staff set/change the on-device agent login.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_agent_credentials(
  p_asset_id UUID,
  p_username TEXT,
  p_passcode TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can set agent credentials';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.device_enrollments WHERE asset_id = p_asset_id) THEN
    RAISE EXCEPTION 'Device is not enrolled';
  END IF;

  IF length(coalesce(p_passcode, '')) < 4 THEN
    RAISE EXCEPTION 'Passcode must be at least 4 characters';
  END IF;

  UPDATE public.device_enrollments
     SET agent_username = nullif(trim(p_username), ''),
         agent_passcode = p_passcode
   WHERE asset_id = p_asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id)
  VALUES (v_actor, 'agent_credentials_set', 'asset', p_asset_id);
END; $$;
