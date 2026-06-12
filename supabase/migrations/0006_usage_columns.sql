-- ============================================================
-- 0006 — Exact usage telemetry from phones
-- Run in the Supabase SQL editor after 0005.
--
-- Android (with the one-time "Usage access" grant) reports, per
-- heartbeat window: real screen-on minutes and the number of unlocks.
-- ============================================================

ALTER TABLE public.heartbeats ADD COLUMN IF NOT EXISTS screen_on_minutes INTEGER;
ALTER TABLE public.heartbeats ADD COLUMN IF NOT EXISTS unlock_count INTEGER;
