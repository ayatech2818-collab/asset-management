-- ============================================================
-- 0011 — Admin Lock/Unlock control for the mobile agent
-- Run in the Supabase SQL editor after 0010.
--
-- Simpler than the username/passcode model: staff flip a single Lock switch
-- per device. Locked → the employee can't open or change the agent. Unlocked →
-- the agent opens freely so staff can make changes; re-lock before handing the
-- phone over. Defaults to unlocked so the initial on-device setup (granting
-- permissions, etc.) is smooth; staff lock it when ready.
-- ============================================================

ALTER TABLE public.device_enrollments
  ADD COLUMN IF NOT EXISTS agent_locked BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- set_agent_lock: staff lock/unlock a device's agent.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_agent_lock(
  p_asset_id UUID,
  p_locked BOOLEAN
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can lock or unlock the agent';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.device_enrollments WHERE asset_id = p_asset_id) THEN
    RAISE EXCEPTION 'Device is not enrolled';
  END IF;

  UPDATE public.device_enrollments
     SET agent_locked = coalesce(p_locked, false)
   WHERE asset_id = p_asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor, 'agent_lock_set', 'asset', p_asset_id,
          jsonb_build_object('locked', coalesce(p_locked, false)));
END; $$;
