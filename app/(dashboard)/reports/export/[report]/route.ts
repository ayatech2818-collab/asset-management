import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { isStaff } from "@/lib/types";
import { toCsv, csvResponse, type CsvValue } from "@/lib/csv";

// CSV exports. Lives under /reports (not /api) so the auth proxy refreshes
// the session before we read it. Staff-only; queries run with the user's
// own client so RLS is enforced as well.
export const runtime = "nodejs";

const PAGE = 1000; // Supabase caps a single request at 1000 rows.

type Q = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

async function fetchAll<Row>(
  build: (from: number, to: number) => Q,
): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

type Rec = Record<string, unknown>;
const name = (v: unknown) => (v as { full_name?: string } | null)?.full_name;
const email = (v: unknown) => (v as { email?: string } | null)?.email;
const tag = (v: unknown) => (v as { asset_tag?: string } | null)?.asset_tag;
const aname = (v: unknown) => (v as { name?: string } | null)?.name;

async function assetsCsv(supabase: Awaited<ReturnType<typeof createClient>>) {
  const rows = await fetchAll<Rec>((from, to) =>
    supabase
      .from("assets")
      .select("*, custodian:current_custodian(full_name, email)")
      .order("asset_tag")
      .range(from, to),
  );
  return toCsv(
    [
      "asset_tag", "name", "category", "brand", "model", "serial_number",
      "status", "condition", "custodian", "custodian_email", "location",
      "purchase_date", "purchase_price", "vendor", "warranty_expiry",
      "monitored", "notes", "created_at",
    ],
    rows.map((a) => [
      a.asset_tag as CsvValue, a.name as CsvValue, a.category as CsvValue,
      a.brand as CsvValue, a.model as CsvValue, a.serial_number as CsvValue,
      a.status as CsvValue, a.condition as CsvValue,
      name(a.custodian), email(a.custodian), a.location as CsvValue,
      a.purchase_date as CsvValue, a.purchase_price as CsvValue,
      a.vendor as CsvValue, a.warranty_expiry as CsvValue,
      a.is_monitored as CsvValue, a.notes as CsvValue, a.created_at as CsvValue,
    ]),
  );
}

async function custodyCsv(supabase: Awaited<ReturnType<typeof createClient>>) {
  const rows = await fetchAll<Rec>((from, to) =>
    supabase
      .from("custody_records")
      .select(
        "*, asset:asset_id(asset_tag, name), custodian:custodian_id(full_name, email), issuer:issued_by(full_name)",
      )
      .order("started_at", { ascending: false })
      .range(from, to),
  );
  return toCsv(
    [
      "asset_tag", "asset_name", "custodian", "custodian_email", "issued_by",
      "started_at", "ended_at", "end_reason", "condition_out", "condition_in",
      "remarks",
    ],
    rows.map((c) => [
      tag(c.asset), aname(c.asset), name(c.custodian), email(c.custodian),
      name(c.issuer), c.started_at as CsvValue, c.ended_at as CsvValue,
      c.end_reason as CsvValue, c.condition_out as CsvValue,
      c.condition_in as CsvValue, c.remarks as CsvValue,
    ]),
  );
}

async function transfersCsv(supabase: Awaited<ReturnType<typeof createClient>>) {
  const rows = await fetchAll<Rec>((from, to) =>
    supabase
      .from("transfers")
      .select(
        "*, asset:asset_id(asset_tag, name), from_p:from_custodian(full_name), to_p:to_custodian(full_name), init:initiated_by(full_name)",
      )
      .order("requested_at", { ascending: false })
      .range(from, to),
  );
  return toCsv(
    [
      "asset_tag", "asset_name", "type", "from", "to", "initiated_by",
      "status", "requested_at", "responded_at", "reason", "remarks",
    ],
    rows.map((t) => [
      tag(t.asset), aname(t.asset), t.type as CsvValue,
      name(t.from_p), name(t.to_p), name(t.init),
      t.status as CsvValue, t.requested_at as CsvValue,
      t.responded_at as CsvValue, t.reason as CsvValue, t.remarks as CsvValue,
    ]),
  );
}

async function auditCsv(supabase: Awaited<ReturnType<typeof createClient>>) {
  const rows = await fetchAll<Rec>((from, to) =>
    supabase
      .from("audit_log")
      .select("*, actor_p:actor(full_name, email)")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  return toCsv(
    ["time", "actor", "actor_email", "action", "entity", "entity_id", "details"],
    rows.map((l) => [
      l.created_at as CsvValue, name(l.actor_p), email(l.actor_p),
      l.action as CsvValue, l.entity as CsvValue, l.entity_id as CsvValue,
      l.details != null ? JSON.stringify(l.details) : "",
    ]),
  );
}

async function monitoringCsv(supabase: Awaited<ReturnType<typeof createClient>>) {
  const enrollments = await fetchAll<Rec>((from, to) =>
    supabase
      .from("device_enrollments")
      .select("*, asset:asset_id(asset_tag, name)")
      .order("enrolled_at")
      .range(from, to),
  );
  // Latest heartbeat per device — one query via the latest_heartbeats view
  // (replaces the previous one-query-per-device N+1).
  const hbRows = await fetchAll<Rec>((from, to) =>
    supabase.from("latest_heartbeats").select("*").range(from, to),
  );
  const byAsset = new Map<string, Rec>();
  for (const h of hbRows) byAsset.set(h.asset_id as string, h);
  const latest = enrollments.map(
    (e) => byAsset.get(e.asset_id as string) ?? ({} as Rec),
  );
  return toCsv(
    [
      "asset_tag", "asset_name", "platform", "online_status", "last_seen",
      "agent_version", "serial_number", "manufacturer", "model", "os_name",
      "os_version", "total_ram_gb", "total_disk_gb", "wifi_ssid",
      "mac_address", "local_ip", "disk_encrypted", "antivirus",
      "hostname", "logged_in_user", "battery_pct",
      "is_charging", "disk_free_gb", "cpu_pct", "ram_pct", "idle_minutes",
      "uptime_minutes", "public_ip", "city", "lat", "lng", "reported_at",
    ],
    enrollments.map((e, i) => {
      const h = latest[i];
      return [
        tag(e.asset), aname(e.asset), e.platform as CsvValue,
        e.online_status as CsvValue, e.last_seen as CsvValue,
        e.agent_version as CsvValue, e.serial_number as CsvValue,
        e.manufacturer as CsvValue, e.model as CsvValue, e.os_name as CsvValue,
        e.os_version as CsvValue, e.total_ram_gb as CsvValue,
        e.total_disk_gb as CsvValue, e.wifi_ssid as CsvValue,
        e.mac_address as CsvValue, e.local_ip as CsvValue,
        e.disk_encrypted as CsvValue, e.antivirus as CsvValue,
        h.hostname as CsvValue,
        h.logged_in_user as CsvValue, h.battery_pct as CsvValue,
        h.is_charging as CsvValue, h.disk_free_gb as CsvValue,
        h.cpu_pct as CsvValue, h.ram_pct as CsvValue,
        h.idle_minutes as CsvValue, h.uptime_minutes as CsvValue,
        h.public_ip as CsvValue, h.city as CsvValue, h.lat as CsvValue,
        h.lng as CsvValue, h.reported_at as CsvValue,
      ];
    }),
  );
}

const REPORTS: Record<
  string,
  (s: Awaited<ReturnType<typeof createClient>>) => Promise<string>
> = {
  assets: assetsCsv,
  custody: custodyCsv,
  transfers: transfersCsv,
  audit: auditCsv,
  monitoring: monitoringCsv,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  const profile = await getProfile();
  if (!profile || !isStaff(profile.role)) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { report } = await params;
  const build = REPORTS[report];
  if (!build) {
    return Response.json({ error: "Unknown report" }, { status: 404 });
  }

  const supabase = await createClient();
  const csv = await build(supabase);
  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`${report}-${date}.csv`, csv);
}
