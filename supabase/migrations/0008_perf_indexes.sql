-- ============================================================
-- 0008 — Performance: filter indexes + latest-heartbeat view
-- Run in the Supabase SQL editor after 0007.
-- ============================================================

-- The asset list filters by category; the monitoring list orders by
-- online_status. Both currently full-scan as data grows.
CREATE INDEX IF NOT EXISTS idx_assets_category
  ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_enroll_online_status
  ON public.device_enrollments(online_status);

-- One row per device — its most recent heartbeat. Replaces two hot patterns:
--   * monitoring list: fetch 400 rows then de-duplicate in JS
--   * monitoring CSV export: one "latest heartbeat" query per device (N+1)
-- DISTINCT ON walks idx_hb_asset_time (asset_id, reported_at DESC), so it
-- returns the newest beat per asset in a single index scan.
--
-- security_invoker = true makes the view run with the querying user's
-- privileges, so the heartbeats RLS policies (p_hb_staff / p_hb_own) still
-- apply — staff see all, custodians see their own.
CREATE OR REPLACE VIEW public.latest_heartbeats
  WITH (security_invoker = true) AS
SELECT DISTINCT ON (asset_id) *
  FROM public.heartbeats
 ORDER BY asset_id, reported_at DESC;
