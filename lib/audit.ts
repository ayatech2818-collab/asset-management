import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Audit log writes use the service-role client because RLS only grants SELECT
// on audit_log to staff — nobody (not even admins) can insert/edit it directly.
// Failures are swallowed: an audit hiccup must never block the actual operation.
export async function writeAudit(
  actor: string,
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor,
      action,
      entity,
      entity_id: entityId,
      details: details ?? null,
    });
  } catch {
    // best-effort only
  }
}
