import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// Service-role client — BYPASSES Row Level Security. SERVER ONLY.
// Used by token-authenticated endpoints (e.g. the device heartbeat /api/ingest)
// and admin operations. NEVER import this into a client component.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
