-- ============================================================
-- 0003 — Alert engine + Realtime
-- Run in the Supabase SQL editor after 0002.
-- ============================================================

-- Scheduled jobs run inside Postgres itself.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Stream alert INSERTs to connected dashboards (RLS still applies).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;
END $$;

-- ------------------------------------------------------------
-- run_alert_checks: generates alerts (deduplicated). Called by
-- pg_cron daily AND on-demand by staff from the Alerts page.
-- Returns the number of new alerts created.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_alert_checks() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_created INTEGER := 0;
  r INTEGER;
BEGIN
  -- When called through the API, only staff may trigger it.
  -- (pg_cron calls it directly as postgres, where auth.uid() is NULL.)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can run alert checks';
  END IF;

  -- 1. Warranty expiring within 30 days
  INSERT INTO public.alerts (asset_id, type, message, severity)
  SELECT a.id, 'WARRANTY_EXPIRING',
         a.name || ' (' || a.asset_tag || ') warranty expires on ' || a.warranty_expiry,
         'med'
    FROM public.assets a
   WHERE a.warranty_expiry IS NOT NULL
     AND a.warranty_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
     AND a.status NOT IN ('retired','lost')
     AND NOT EXISTS (SELECT 1 FROM public.alerts al
                     WHERE al.asset_id = a.id
                       AND al.type = 'WARRANTY_EXPIRING'
                       AND al.status = 'active');
  GET DIAGNOSTICS r = ROW_COUNT;
  v_created := v_created + r;

  -- 2. Warranty already expired (still active asset)
  INSERT INTO public.alerts (asset_id, type, message, severity)
  SELECT a.id, 'WARRANTY_EXPIRED',
         a.name || ' (' || a.asset_tag || ') warranty expired on ' || a.warranty_expiry,
         'high'
    FROM public.assets a
   WHERE a.warranty_expiry IS NOT NULL
     AND a.warranty_expiry < CURRENT_DATE
     AND a.status NOT IN ('retired','lost')
     AND NOT EXISTS (SELECT 1 FROM public.alerts al
                     WHERE al.asset_id = a.id
                       AND al.type = 'WARRANTY_EXPIRED'
                       AND al.status = 'active');
  GET DIAGNOSTICS r = ROW_COUNT;
  v_created := v_created + r;

  -- 3. Transfers stuck pending for more than 3 days
  INSERT INTO public.alerts (asset_id, type, message, severity)
  SELECT t.asset_id, 'CUSTODY_PENDING_3D',
         'A ' || t.type || ' has been pending acceptance for over 3 days',
         'med'
    FROM public.transfers t
   WHERE t.status = 'pending'
     AND t.requested_at < NOW() - INTERVAL '3 days'
     AND NOT EXISTS (SELECT 1 FROM public.alerts al
                     WHERE al.asset_id = t.asset_id
                       AND al.type = 'CUSTODY_PENDING_3D'
                       AND al.status = 'active');
  GET DIAGNOSTICS r = ROW_COUNT;
  v_created := v_created + r;

  RETURN v_created;
END; $$;

-- Daily at 09:00 UTC (14:30 IST)
SELECT cron.schedule('alert-checks', '0 9 * * *', $$SELECT public.run_alert_checks()$$);

-- ------------------------------------------------------------
-- resolve_alert: staff resolves an active alert.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_alert(p_alert_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_actor AND role IN ('admin','asset_manager')
  ) THEN
    RAISE EXCEPTION 'Only staff can resolve alerts';
  END IF;

  UPDATE public.alerts
     SET status = 'resolved', resolved_by = v_actor, resolved_at = NOW()
   WHERE id = p_alert_id AND status = 'active';

  IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found or already resolved'; END IF;

  INSERT INTO public.audit_log (actor, action, entity, entity_id)
  VALUES (v_actor, 'alert_resolved', 'alert', p_alert_id);
END; $$;
