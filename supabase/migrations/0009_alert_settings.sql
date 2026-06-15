-- ============================================================
-- 0009 — Configurable alert thresholds (battery + disk)
-- Run in the Supabase SQL editor after 0008.
--
-- The low-battery / low-disk thresholds were hard-coded in the /api/ingest
-- route. This makes them admin-configurable. (Offline thresholds stay in
-- check_offline_devices(), which is intentionally platform-aware.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alert_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  low_battery_pct INTEGER     NOT NULL DEFAULT 15,
  low_disk_gb     NUMERIC     NOT NULL DEFAULT 10,
  updated_by      UUID REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_settings_singleton CHECK (id = 1)
);

-- Seed the single settings row.
INSERT INTO public.alert_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may read the thresholds (harmless, and the ingest route
-- reads with the service-role key which bypasses RLS anyway). Writes go through
-- the SECURITY DEFINER function below, so no write policy is needed.
CREATE POLICY p_alert_settings_read ON public.alert_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- update_alert_settings: admin-only update of the thresholds.
-- Mirrors the SECURITY DEFINER + admin-check pattern used by the custody RPCs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_alert_settings(
  p_low_battery_pct INTEGER,
  p_low_disk_gb     NUMERIC
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change alert settings';
  END IF;

  IF p_low_battery_pct < 1 OR p_low_battery_pct > 100 THEN
    RAISE EXCEPTION 'Battery threshold must be between 1 and 100';
  END IF;
  IF p_low_disk_gb < 0 THEN
    RAISE EXCEPTION 'Disk threshold must be 0 or more';
  END IF;

  UPDATE public.alert_settings
     SET low_battery_pct = p_low_battery_pct,
         low_disk_gb     = p_low_disk_gb,
         updated_by      = v_actor,
         updated_at      = NOW()
   WHERE id = 1;

  INSERT INTO public.audit_log (actor, action, entity, entity_id, details)
  VALUES (v_actor, 'alert_settings_updated', 'alert_settings', NULL,
          jsonb_build_object('low_battery_pct', p_low_battery_pct,
                             'low_disk_gb', p_low_disk_gb));
END; $$;
