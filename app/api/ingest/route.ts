import { NextRequest, NextResponse, after } from "next/server";
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

// Reverse geocoding for device-supplied coordinates (OpenStreetMap Nominatim,
// free). The IP-derived city can be a different town entirely (ISP exit node),
// so when we have real coordinates the label must come from them. Cached per
// ~1 km grid cell per server instance.
const geoLabelCache = new Map<string, string>();

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = geoLabelCache.get(key);
  if (cached) return cached;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=14&accept-language=en`,
      {
        signal: ctrl.signal,
        headers: { "User-Agent": "AssetHub/1.0 (ayatechai@gmail.com)" },
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    // Locality-level label: neighbourhood/suburb first, then the city.
    const locality = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.hamlet;
    const place =
      a.city ?? a.town ?? a.village ?? a.county ?? a.state_district;
    const label = [locality, place, a.state].filter(Boolean).join(", ");
    if (label) geoLabelCache.set(key, label);
    return label || null;
  } catch {
    return null;
  }
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

// Alert thresholds are admin-configurable (alert_settings, migration 0009).
// Cached for 60s so heartbeats don't read them every time; falls back to the
// previous hard-coded defaults if the table hasn't been migrated yet.
let thresholdCache: { battery: number; disk: number; at: number } | null = null;

async function getThresholds(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ battery: number; disk: number }> {
  if (thresholdCache && Date.now() - thresholdCache.at < 60_000) {
    return { battery: thresholdCache.battery, disk: thresholdCache.disk };
  }
  let battery = 15;
  let disk = 10;
  try {
    const { data } = await admin
      .from("alert_settings")
      .select("low_battery_pct, low_disk_gb")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      battery = (data.low_battery_pct as number) ?? 15;
      disk = Number(data.low_disk_gb ?? 10);
    }
  } catch {
    // table not migrated yet — keep defaults
  }
  thresholdCache = { battery, disk, at: Date.now() };
  return { battery, disk };
}

async function runDeviceAlerts(
  admin: ReturnType<typeof createAdminClient>,
  assetId: string,
  body: Body,
  thresholds: { battery: number; disk: number },
) {
  const checks: { type: string; severity: string; message: string }[] = [];
  const battery = num(body.battery_pct);
  const disk = num(body.disk_free_gb);

  if (battery != null && battery < thresholds.battery && body.is_charging !== true) {
    checks.push({
      type: "LOW_BATTERY",
      severity: "med",
      message: `Battery low (${battery}%)`,
    });
  }
  if (disk != null && disk < thresholds.disk) {
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
    .select("asset_id, is_active, agent_locked")
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

  // Location from the agent payload only — no blocking network calls here.
  // GPS coordinates (phones) are stored as-is; the human-readable city label
  // (reverse geocoding) and IP-based fallback are resolved after the response
  // in `after()` below, so the agent isn't held for 0.5–2s on external APIs.
  const lat = num(body.lat);
  const lng = num(body.lng);
  const loc_source = str(body.loc_source) ?? (lat != null ? "gps" : null);

  const { data: inserted } = await admin
    .from("heartbeats")
    .insert({
      asset_id: assetId,
      hostname: str(body.hostname),
      logged_in_user: str(body.logged_in_user),
      public_ip: ip,
      lat,
      lng,
      city: null,
      loc_accuracy_m: num(body.loc_accuracy_m),
      loc_source,
      idle_minutes: num(body.idle_minutes),
      uptime_minutes: num(body.uptime_minutes),
      battery_pct: num(body.battery_pct),
      is_charging:
        typeof body.is_charging === "boolean" ? body.is_charging : null,
      disk_free_gb: num(body.disk_free_gb),
      cpu_pct: num(body.cpu_pct),
      ram_pct: num(body.ram_pct),
      // Only included when the agent sends them, so heartbeats keep working
      // even before migration 0006 adds the columns.
      ...(num(body.screen_on_minutes) != null
        ? { screen_on_minutes: num(body.screen_on_minutes) }
        : {}),
      ...(num(body.unlock_count) != null
        ? { unlock_count: num(body.unlock_count) }
        : {}),
    })
    .select("id")
    .single();

  const bool = (v: unknown): boolean | null =>
    typeof v === "boolean" ? v : null;

  await admin
    .from("device_enrollments")
    .update({
      last_seen: new Date().toISOString(),
      online_status: "online",
      agent_version: str(body.agent_version),
      // Tier 1 device facts — only overwrite when the agent reports a value,
      // so a field the platform can't read doesn't wipe a known one.
      ...(str(body.serial_number) != null && {
        serial_number: str(body.serial_number),
      }),
      ...(str(body.manufacturer) != null && {
        manufacturer: str(body.manufacturer),
      }),
      ...(str(body.model) != null && { model: str(body.model) }),
      ...(str(body.os_name) != null && { os_name: str(body.os_name) }),
      ...(str(body.os_version) != null && {
        os_version: str(body.os_version),
      }),
      ...(num(body.total_ram_gb) != null && {
        total_ram_gb: num(body.total_ram_gb),
      }),
      ...(num(body.total_disk_gb) != null && {
        total_disk_gb: num(body.total_disk_gb),
      }),
      ...(str(body.mac_address) != null && {
        mac_address: str(body.mac_address),
      }),
      ...(str(body.wifi_ssid) != null && { wifi_ssid: str(body.wifi_ssid) }),
      ...(str(body.local_ip) != null && { local_ip: str(body.local_ip) }),
      ...(bool(body.disk_encrypted) != null && {
        disk_encrypted: bool(body.disk_encrypted),
      }),
      ...(str(body.antivirus) != null && { antivirus: str(body.antivirus) }),
      ...(str(body.battery_health) != null && {
        battery_health: str(body.battery_health),
      }),
    })
    .eq("asset_id", assetId);

  // Flag a token installed on a device whose serial doesn't match the asset.
  const serial = str(body.serial_number);
  if (serial) {
    await admin.rpc("check_serial_match", {
      p_asset_id: assetId,
      p_serial: serial,
    });
  }

  const thresholds = await getThresholds(admin);
  await runDeviceAlerts(admin, assetId, body, thresholds);

  // Resolve the location label without blocking the agent. For GPS beats this
  // fills in the city; for beats with no coordinates it backfills lat/lng/city
  // from IP geolocation. Runs after the response is sent.
  const hbId = inserted?.id as number | undefined;
  if (hbId != null) {
    after(async () => {
      let glat = lat;
      let glng = lng;
      let gcity: string | null = null;
      let gsource = loc_source;
      if (lat == null) {
        const geo = await geolocate(ip);
        if (geo) {
          glat = geo.lat;
          glng = geo.lng;
          gcity = geo.city;
          gsource = "ip";
        }
      } else if (lng != null) {
        gcity = await reverseGeocode(lat, lng);
        if (!gcity) {
          const geo = await geolocate(ip);
          if (geo) gcity = geo.city;
        }
      }
      if (gcity != null || glat !== lat) {
        await admin
          .from("heartbeats")
          .update({ lat: glat, lng: glng, city: gcity, loc_source: gsource })
          .eq("id", hbId);
      }
    });
  }

  // Push the current lock state down so the agent caches it and gates its UI.
  return NextResponse.json({
    ok: true,
    interval_seconds: 300,
    locked: enrollment.agent_locked === true,
  });
}
