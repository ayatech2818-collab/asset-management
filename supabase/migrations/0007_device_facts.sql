-- ============================================================
-- 0007 — Tier 1 device facts (inventory + security posture)
-- Run in the Supabase SQL editor after 0006.
--
-- These are slow-changing "current state" facts (serial, model, OS,
-- specs, encryption, antivirus), so they live on device_enrollments and
-- are refreshed on every heartbeat by /api/ingest — not duplicated into
-- the heartbeat time series.
-- ============================================================

ALTER TABLE public.device_enrollments
  ADD COLUMN IF NOT EXISTS serial_number   TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer    TEXT,
  ADD COLUMN IF NOT EXISTS model           TEXT,
  ADD COLUMN IF NOT EXISTS os_name         TEXT,
  ADD COLUMN IF NOT EXISTS os_version      TEXT,
  ADD COLUMN IF NOT EXISTS total_ram_gb    NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS total_disk_gb   NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS mac_address     TEXT,
  ADD COLUMN IF NOT EXISTS wifi_ssid       TEXT,
  ADD COLUMN IF NOT EXISTS local_ip        TEXT,
  ADD COLUMN IF NOT EXISTS disk_encrypted  BOOLEAN,
  ADD COLUMN IF NOT EXISTS antivirus       TEXT,
  ADD COLUMN IF NOT EXISTS battery_health  TEXT;

-- ------------------------------------------------------------
-- check_serial_match: if the agent reports a hardware serial that does
-- not match the asset's registered serial_number, raise a SERIAL_MISMATCH
-- alert. Catches a token installed on the wrong/swapped machine.
-- Called by /api/ingest after each heartbeat (service role).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_serial_match(p_asset_id UUID, p_serial TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_registered TEXT;
  v_name TEXT;
  v_tag TEXT;
BEGIN
  IF p_serial IS NULL OR length(trim(p_serial)) = 0 THEN RETURN; END IF;

  SELECT serial_number, name, asset_tag INTO v_registered, v_name, v_tag
    FROM public.assets WHERE id = p_asset_id;

  -- No registered serial yet: backfill it from the device, don't alert.
  IF v_registered IS NULL OR length(trim(v_registered)) = 0 THEN
    UPDATE public.assets SET serial_number = p_serial, updated_at = NOW()
     WHERE id = p_asset_id;
    RETURN;
  END IF;

  IF lower(trim(v_registered)) <> lower(trim(p_serial)) THEN
    INSERT INTO public.alerts (asset_id, type, message, severity)
    SELECT p_asset_id, 'SERIAL_MISMATCH',
           v_name || ' (' || v_tag || '): device serial "' || p_serial ||
           '" does not match the registered serial "' || v_registered || '"',
           'high'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.alerts
       WHERE asset_id = p_asset_id AND type = 'SERIAL_MISMATCH' AND status = 'active'
    );
  END IF;
END; $$;
