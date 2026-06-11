-- ============================================================
-- 0004 — Device monitoring: enrollment + offline detection
-- Run in the Supabase SQL editor after 0003.
-- Heartbeat ingestion itself is handled by the Next.js /api/ingest
-- route using the service-role key (agents are not Supabase users).
-- ============================================================

-- Human-readable location from IP geolocation (e.g. "Kochi, Kerala, India").
ALTER TABLE public.heartbeats ADD COLUMN IF NOT EXISTS city TEXT;

-- ------------------------------------------------------------
-- enroll_device: staff generates a monitoring token for an asset.
-- Returns the plaintext token (shown once in the UI). Re-enrolling
-- rotates the token and reactivates monitoring.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_device(
  p_asset_id UUID,
  p_platform TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_token TEXT;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can enroll devices';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE id = p_asset_id) THEN
    RAISE EXCEPTION 'Asset not found';
  END IF;

  IF p_platform NOT IN ('windows','mac','android','ios') THEN
    RAISE EXCEPTION 'Invalid platform: %', p_platform;
  END IF;

  -- Two v4 UUIDs = 64 hex chars / ~244 random bits. gen_random_uuid() is
  -- built into Postgres (pg_catalog), so it resolves even with search_path=''.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.device_enrollments
    (asset_id, device_token, platform, is_active, online_status)
  VALUES (p_asset_id, v_token, p_platform, TRUE, 'offline')
  ON CONFLICT (asset_id) DO UPDATE
    SET device_token = EXCLUDED.device_token,
        platform     = EXCLUDED.platform,
        is_active    = TRUE,
        enrolled_at  = NOW(),
        last_seen    = NULL,
        online_status = 'offline';

  UPDATE public.assets SET is_monitored = TRUE, updated_at = NOW()
   WHERE id = p_asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor, 'device_enrolled', 'asset', p_asset_id,
          jsonb_build_object('platform', p_platform));

  RETURN v_token;
END; $$;

-- ------------------------------------------------------------
-- unenroll_device: stop monitoring an asset.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unenroll_device(p_asset_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can unenroll devices';
  END IF;

  DELETE FROM public.device_enrollments WHERE asset_id = p_asset_id;
  UPDATE public.assets SET is_monitored = FALSE, updated_at = NOW()
   WHERE id = p_asset_id;

  INSERT INTO public.audit_log (actor, action, entity, entity_id)
  VALUES (v_actor, 'device_unenrolled', 'asset', p_asset_id);
END; $$;

-- ------------------------------------------------------------
-- check_offline_devices: flips devices to offline after 15 min of
-- silence and raises a DEVICE_OFFLINE alert (deduplicated).
-- Runs every 5 minutes via pg_cron.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_offline_devices() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.device_enrollments
     SET online_status = 'offline'
   WHERE is_active
     AND online_status = 'online'
     AND last_seen < NOW() - INTERVAL '15 minutes';

  INSERT INTO public.alerts (asset_id, type, message, severity)
  SELECT de.asset_id, 'DEVICE_OFFLINE',
         a.name || ' (' || a.asset_tag || ') has stopped reporting',
         'high'
    FROM public.device_enrollments de
    JOIN public.assets a ON a.id = de.asset_id
   WHERE de.is_active
     AND de.online_status = 'offline'
     AND de.last_seen IS NOT NULL
     AND de.last_seen < NOW() - INTERVAL '15 minutes'
     AND de.last_seen > NOW() - INTERVAL '25 minutes'  -- only newly offline
     AND NOT EXISTS (SELECT 1 FROM public.alerts al
                     WHERE al.asset_id = de.asset_id
                       AND al.type = 'DEVICE_OFFLINE'
                       AND al.status = 'active');
END; $$;

SELECT cron.schedule('offline-check', '*/5 * * * *',
  $$SELECT public.check_offline_devices()$$);

-- ------------------------------------------------------------
-- Retention: keep 90 days of raw heartbeats. Daily at 03:00 UTC.
-- ------------------------------------------------------------
SELECT cron.schedule('heartbeat-retention', '0 3 * * *',
  $$DELETE FROM public.heartbeats WHERE reported_at < NOW() - INTERVAL '90 days'$$);
