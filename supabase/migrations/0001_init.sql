-- ============================================================
-- Asset Management System — initial schema
-- Run in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================

-- ============================================================
-- 1. PROFILES (employees) — extends Supabase Auth
-- ============================================================
CREATE TABLE profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  employee_code TEXT UNIQUE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  department    TEXT,
  designation   TEXT,
  role          TEXT NOT NULL DEFAULT 'employee', -- 'admin' | 'asset_manager' | 'employee'
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new auth user signs up.
-- NOTE: must be schema-qualified + empty search_path — the auth service runs
-- this trigger with `search_path = auth`, so a bare `profiles` won't resolve.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. ASSETS — the registry
-- ============================================================
CREATE TABLE assets (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_tag         TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,   -- laptop|mobile|monitor|vehicle|furniture|tool|other
  brand             TEXT,
  model             TEXT,
  serial_number     TEXT,
  purchase_date     DATE,
  purchase_price    NUMERIC(12,2),
  vendor            TEXT,
  warranty_expiry   DATE,
  condition         TEXT DEFAULT 'good',   -- new|good|fair|damaged
  status            TEXT NOT NULL DEFAULT 'in_stock',
        -- in_stock | assigned | pending_acceptance | under_repair | retired | lost
  current_custodian UUID REFERENCES profiles(id) ON DELETE SET NULL,
  location          TEXT,
  is_monitored      BOOLEAN DEFAULT FALSE,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_assets_custodian ON assets(current_custodian);
CREATE INDEX idx_assets_status    ON assets(status);

-- ============================================================
-- 3. CUSTODY RECORDS — the chain-of-custody ledger
-- ============================================================
CREATE TABLE custody_records (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  custodian_id  UUID REFERENCES profiles(id) NOT NULL,
  issued_by     UUID REFERENCES profiles(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  end_reason    TEXT,
  condition_out TEXT,
  condition_in  TEXT,
  remarks       TEXT
);
CREATE INDEX idx_custody_asset  ON custody_records(asset_id);
CREATE INDEX idx_custody_active ON custody_records(asset_id) WHERE ended_at IS NULL;

-- ============================================================
-- 4. TRANSFERS — the handover workflow (requires acceptance)
-- ============================================================
CREATE TABLE transfers (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id       UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  type           TEXT NOT NULL,        -- issue | transfer | return
  from_custodian UUID REFERENCES profiles(id),
  to_custodian   UUID REFERENCES profiles(id),
  initiated_by   UUID REFERENCES profiles(id) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | cancelled
  reason         TEXT,
  remarks        TEXT,
  requested_at   TIMESTAMPTZ DEFAULT NOW(),
  responded_at   TIMESTAMPTZ
);
CREATE INDEX idx_transfers_pending ON transfers(to_custodian) WHERE status = 'pending';

-- ============================================================
-- 5. AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor      UUID REFERENCES profiles(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  UUID,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. accept_transfer — atomic custody handover (RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION accept_transfer(p_transfer_id UUID)
RETURNS void AS $$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM transfers
   WHERE id = p_transfer_id AND status = 'pending'
     AND (to_custodian = auth.uid()
          OR (type = 'return' AND EXISTS
              (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('admin','asset_manager'))))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found, not pending, or not addressed to you';
  END IF;

  UPDATE custody_records
     SET ended_at = NOW(),
         end_reason = CASE t.type WHEN 'return' THEN 'returned' ELSE 'transferred' END
   WHERE asset_id = t.asset_id AND ended_at IS NULL;

  IF t.type = 'return' THEN
    UPDATE assets SET current_custodian = NULL, status = 'in_stock', updated_at = NOW()
     WHERE id = t.asset_id;
  ELSE
    INSERT INTO custody_records (asset_id, custodian_id, issued_by)
         VALUES (t.asset_id, t.to_custodian, t.initiated_by);
    UPDATE assets SET current_custodian = t.to_custodian, status = 'assigned', updated_at = NOW()
     WHERE id = t.asset_id;
  END IF;

  UPDATE transfers SET status = 'accepted', responded_at = NOW()
   WHERE id = p_transfer_id;

  INSERT INTO audit_log (actor, action, entity, entity_id, details)
  VALUES (auth.uid(), 'transfer_accepted', 'transfer', p_transfer_id,
          jsonb_build_object('asset_id', t.asset_id, 'type', t.type));
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. DEVICE ENROLLMENTS — monitoring agent registration
-- ============================================================
CREATE TABLE device_enrollments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE UNIQUE NOT NULL,
  device_token  TEXT UNIQUE NOT NULL,
  platform      TEXT NOT NULL,        -- windows | mac | android | ios
  agent_version TEXT,
  enrolled_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen     TIMESTAMPTZ,
  online_status TEXT DEFAULT 'offline',
  is_active     BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 8. HEARTBEATS — telemetry
-- ============================================================
CREATE TABLE heartbeats (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id       UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  reported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hostname       TEXT,
  logged_in_user TEXT,
  public_ip      INET,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  loc_accuracy_m INTEGER,
  loc_source     TEXT,            -- wifi | ip | gps
  idle_minutes   INTEGER,
  uptime_minutes INTEGER,
  battery_pct    INTEGER,
  is_charging    BOOLEAN,
  disk_free_gb   NUMERIC(8,1),
  cpu_pct        INTEGER,
  ram_pct        INTEGER
);
CREATE INDEX idx_hb_asset_time ON heartbeats(asset_id, reported_at DESC);

-- ============================================================
-- 9. ALERTS
-- ============================================================
CREATE TABLE alerts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  severity    TEXT DEFAULT 'low',        -- low | med | high
  status      TEXT DEFAULT 'active',     -- active | resolved
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_active ON alerts(status) WHERE status = 'active';

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = auth.uid() AND role IN ('admin','asset_manager'));
$$;

CREATE POLICY p_profiles_read  ON profiles FOR SELECT USING (true);
CREATE POLICY p_profiles_admin ON profiles FOR ALL    USING (is_staff());

CREATE POLICY p_assets_staff ON assets FOR ALL    USING (is_staff());
CREATE POLICY p_assets_own   ON assets FOR SELECT USING (current_custodian = auth.uid());

CREATE POLICY p_custody_staff ON custody_records FOR ALL    USING (is_staff());
CREATE POLICY p_custody_own   ON custody_records FOR SELECT USING (custodian_id = auth.uid());

CREATE POLICY p_transfers_staff ON transfers FOR ALL USING (is_staff());
CREATE POLICY p_transfers_mine  ON transfers FOR SELECT
  USING (from_custodian = auth.uid() OR to_custodian = auth.uid());
CREATE POLICY p_transfers_request ON transfers FOR INSERT
  WITH CHECK (initiated_by = auth.uid() AND from_custodian = auth.uid());

CREATE POLICY p_hb_staff ON heartbeats FOR SELECT USING (is_staff());
CREATE POLICY p_hb_own   ON heartbeats FOR SELECT USING (
  asset_id IN (SELECT id FROM assets WHERE current_custodian = auth.uid()));
CREATE POLICY p_enroll_staff ON device_enrollments FOR ALL USING (is_staff());

CREATE POLICY p_alerts_staff ON alerts FOR ALL USING (is_staff());
CREATE POLICY p_alerts_own   ON alerts FOR SELECT USING (
  asset_id IN (SELECT id FROM assets WHERE current_custodian = auth.uid()));

CREATE POLICY p_audit_staff ON audit_log FOR SELECT USING (is_staff());

-- ============================================================
-- 11. SCHEDULED JOBS (pg_cron) — enable the pg_cron extension first
--     (Dashboard → Database → Extensions), then uncomment.
-- ============================================================
-- SELECT cron.schedule('offline-check', '*/5 * * * *', $$
--   UPDATE device_enrollments SET online_status = 'offline'
--    WHERE online_status = 'online' AND last_seen < NOW() - INTERVAL '15 minutes';
-- $$);
