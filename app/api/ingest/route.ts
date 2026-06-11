import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Device heartbeat endpoint. Agents authenticate with their device_token
// (not a Supabase session), so this uses the service-role client and is
// excluded from the auth proxy. Node.js runtime for the service-role key.
export const runtime = "nodejs";

type Body = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

function clientIp(req: NextRequest, bodyIp: string | null): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const fromHeader = xff ? xff.split(",")[0].trim() : null;
  // Prefer the edge-observed IP, but fall back to the agent-reported public IP
  // when the header is missing or private (localhost, internal proxies).
  if (fromHeader && !isPrivate(fromHeader)) return fromHeader;
  return bodyIp ?? fromHeader;
}

function isPrivate(ip: string | null): boolean {
  if (!ip) return true;
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

// Free, no-key IP geolocation (city accuracy). Best-effort: never blocks ingest.
async function geolocate(ip: string | null) {
  if (isPrivate(ip)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    const j = (await res.json()) as Record<string, unknown>;
    if (j.status !== "success") return null;
    return {
      lat: j.lat as number,
      lng: j.lon as number,
      city: [j.city, j.regionName, j.country].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
}

async function runDeviceAlerts(
  admin: ReturnType<typeof createAdminClient>,
  assetId: string,
  body: Body,
) {
  const checks: { type: string; severity: string; message: string }[] = [];
  const battery = num(body.battery_pct);
  const disk = num(body.disk_free_gb);

  if (battery != null && battery < 15 && body.is_charging !== true) {
    checks.push({
      type: "LOW_BATTERY",
      severity: "med",
      message: `Battery low (${battery}%)`,
    });
  }
  if (disk != null && disk < 10) {
    checks.push({
      type: "LOW_DISK",
      severity: "med",
      message: `Low disk space (${disk} GB free)`,
    });
  }

  for (const c of checks) {
    const { data: existing } = await admin
      .from("alerts")
      .select("id")
      .eq("asset_id", assetId)
      .eq("type", c.type)
      .eq("status", "active")
      .limit(1);
    if (!existing || existing.length === 0) {
      await admin.from("alerts").insert({ asset_id: assetId, ...c });
    }
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = str(body.device_token);
  if (!token) {
    return NextResponse.json({ error: "Missing device_token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("device_enrollments")
    .select("asset_id, is_active")
    .eq("device_token", token)
    .single();

  if (!enrollment || !enrollment.is_active) {
    return NextResponse.json(
      { error: "Invalid or inactive device token" },
      { status: 401 },
    );
  }

  const assetId = enrollment.asset_id as string;
  const ip = clientIp(req, str(body.public_ip));

  // Location: prefer agent GPS (phones), else server-side IP geolocation.
  let lat = num(body.lat);
  let lng = num(body.lng);
  let loc_source = str(body.loc_source) ?? (lat != null ? "gps" : null);
  let city: string | null = null;
  if (lat == null) {
    const geo = await geolocate(ip);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      city = geo.city;
      loc_source = "ip";
    }
  }

  await admin.from("heartbeats").insert({
    asset_id: assetId,
    hostname: str(body.hostname),
    logged_in_user: str(body.logged_in_user),
    public_ip: ip,
    lat,
    lng,
    city,
    loc_accuracy_m: num(body.loc_accuracy_m),
    loc_source,
    idle_minutes: num(body.idle_minutes),
    uptime_minutes: num(body.uptime_minutes),
    battery_pct: num(body.battery_pct),
    is_charging: typeof body.is_charging === "boolean" ? body.is_charging : null,
    disk_free_gb: num(body.disk_free_gb),
    cpu_pct: num(body.cpu_pct),
    ram_pct: num(body.ram_pct),
  });

  await admin
    .from("device_enrollments")
    .update({
      last_seen: new Date().toISOString(),
      online_status: "online",
      agent_version: str(body.agent_version),
    })
    .eq("asset_id", assetId);

  await runDeviceAlerts(admin, assetId, body);

  return NextResponse.json({ ok: true, interval_seconds: 300 });
}
