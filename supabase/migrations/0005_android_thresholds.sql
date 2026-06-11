-- ============================================================
-- 0005 — Platform-aware offline thresholds
-- Run in the Supabase SQL editor after 0004.
--
-- Laptops heartbeat every 5 minutes (Scheduled Task) → 15-min threshold.
-- Phones use WorkManager, whose minimum interval is 15 minutes and which
-- Android may delay under Doze → 40-min threshold so they don't flap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_offline_devices() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.device_enrollments de
     SET online_status = 'offline'
   WHERE de.is_active
     AND de.online_status = 'online'
     AND de.last_seen < NOW() - (CASE WHEN de.platform IN ('android','ios')
                                      THEN INTERVAL '40 minutes'
                                      ELSE INTERVAL '15 minutes' END);

  INSERT INTO public.alerts (asset_id, type, message, severity)
  SELECT de.asset_id, 'DEVICE_OFFLINE',
         a.name || ' (' || a.asset_tag || ') has stopped reporting',
         'high'
    FROM public.device_enrollments de
    JOIN public.assets a ON a.id = de.asset_id
   CROSS JOIN LATERAL (
     SELECT CASE WHEN de.platform IN ('android','ios')
                 THEN INTERVAL '40 minutes'
                 ELSE INTERVAL '15 minutes' END AS threshold
   ) t
   WHERE de.is_active
     AND de.online_status = 'offline'
     AND de.last_seen IS NOT NULL
     AND de.last_seen < NOW() - t.threshold
     AND de.last_seen > NOW() - (t.threshold + INTERVAL '10 minutes')  -- only newly offline
     AND NOT EXISTS (SELECT 1 FROM public.alerts al
                     WHERE al.asset_id = de.asset_id
                       AND al.type = 'DEVICE_OFFLINE'
                       AND al.status = 'active');
END; $$;
