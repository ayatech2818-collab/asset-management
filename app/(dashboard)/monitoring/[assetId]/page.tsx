import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  ExternalLink,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Cpu,
} from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ActivityChart, type ActivityPoint } from "@/components/monitoring/ActivityChart";
import { AgentControlPanel } from "@/components/monitoring/AgentControlPanel";
import {
  cadenceFor,
  computeSessions,
  dailyUsage,
  fmtMinutes,
  fmtRange,
} from "@/lib/usage";
import type { Asset, DeviceEnrollment, Heartbeat } from "@/lib/types";

// Request-time cutoff for the heartbeat window (kept out of the component body
// so the lint purity rule doesn't flag Date.now()).
function windowStartISO(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`mt-0.5 break-words text-sm ${
          tone === "warn"
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

// Serial reported by the device, with a match check against the registry.
function DetailWithMatch({
  label,
  reported,
  registered,
}: {
  label: string;
  reported: string | null;
  registered: string | null;
}) {
  const norm = (s: string | null) => s?.trim().toLowerCase() ?? "";
  const matches =
    reported && registered ? norm(reported) === norm(registered) : null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 break-words text-sm text-slate-900 dark:text-slate-100">
        {reported ?? "—"}
        {matches === true && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            <ShieldCheck className="h-3.5 w-3.5" /> matches
          </span>
        )}
        {matches === false && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            <ShieldAlert className="h-3.5 w-3.5" /> mismatch
          </span>
        )}
      </div>
    </div>
  );
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const supabase = await createClient();

  // Run the role guard concurrently with data fetching instead of blocking
  // the queries behind it — the redirect (if any) still resolves first.
  const [, { data: assetData }, { data: enrollData }, { data: hbData }] =
    await Promise.all([
      requireStaff(),
      supabase.from("assets").select("*").eq("id", assetId).single(),
      supabase
        .from("device_enrollments")
        .select("*")
        .eq("asset_id", assetId)
        .single(),
      supabase
        .from("heartbeats")
        .select("*")
        .eq("asset_id", assetId)
        .gte("reported_at", windowStartISO(7))
        .order("reported_at", { ascending: false })
        .limit(1000),
    ]);

  const asset = assetData as Asset | null;
  const enrollment = enrollData as DeviceEnrollment | null;
  if (!asset || !enrollment) notFound();

  const heartbeats = (hbData ?? []) as Heartbeat[];
  const latest = heartbeats[0] ?? null;

  // Usage sessions derived from the idle/screen-state stream.
  const cadence = cadenceFor(enrollment.platform);
  const sessions = computeSessions(heartbeats, cadence);
  const days = dailyUsage(sessions);

  // Exact usage (phones with Usage access granted): unlock counts and real
  // screen-on minutes reported per heartbeat window.
  const exactByDay = new Map<string, { unlocks: number; screenOn: number }>();
  for (const h of heartbeats) {
    if (h.unlock_count == null && h.screen_on_minutes == null) continue;
    const key = new Date(h.reported_at).toDateString();
    const d = exactByDay.get(key) ?? { unlocks: 0, screenOn: 0 };
    d.unlocks += h.unlock_count ?? 0;
    d.screenOn += h.screen_on_minutes ?? 0;
    exactByDay.set(key, d);
  }
  const hasExact = exactByDay.size > 0;

  // Oldest → newest for the chart (most recent 100 beats).
  const chart: ActivityPoint[] = [...heartbeats.slice(0, 100)]
    .reverse()
    .map((h) => ({
      time: new Date(h.reported_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      battery: h.battery_pct,
      idle: h.idle_minutes,
    }));

  const idle = latest?.idle_minutes ?? null;
  const activityLabel =
    idle == null ? "—" : idle < 5 ? "Active" : `Idle (${idle} min)`;

  return (
    <div>
      <Link
        href="/monitoring"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to monitoring
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {asset.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                enrollment.online_status === "online"
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  enrollment.online_status === "online"
                    ? "bg-green-500"
                    : "bg-slate-400"
                }`}
              />
              {enrollment.online_status}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {asset.asset_tag} ·{" "}
            <Link href={`/assets/${asset.id}`} className="hover:underline">
              asset details
            </Link>
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          {enrollment.platform} · agent {enrollment.agent_version ?? "—"}
          <br />
          last seen{" "}
          {enrollment.last_seen
            ? new Date(enrollment.last_seen).toLocaleString()
            : "never"}
        </div>
      </div>

      {(enrollment.platform === "android" || enrollment.platform === "ios") && (
        <AgentControlPanel assetId={assetId} locked={enrollment.agent_locked} />
      )}

      {latest == null ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Enrolled, but no heartbeats received yet. Install and start the agent
          on this device — data appears here within a few minutes.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Activity" value={activityLabel} />
            <Stat
              label="Battery"
              value={
                latest.battery_pct != null
                  ? `${latest.battery_pct}%${latest.is_charging ? " (charging)" : ""}`
                  : "—"
              }
            />
            <Stat label="Logged-in user" value={latest.logged_in_user} />
            <Stat label="Hostname" value={latest.hostname} />
            <Stat
              label="Disk free"
              value={latest.disk_free_gb != null ? `${latest.disk_free_gb} GB` : "—"}
            />
            <Stat
              label="CPU / RAM"
              value={
                latest.cpu_pct != null || latest.ram_pct != null
                  ? `${latest.cpu_pct ?? "—"}% / ${latest.ram_pct ?? "—"}%`
                  : "—"
              }
            />
            <Stat
              label="Uptime"
              value={
                latest.uptime_minutes != null
                  ? `${Math.floor(latest.uptime_minutes / 60)}h ${latest.uptime_minutes % 60}m`
                  : "—"
              }
            />
            <Stat label="Public IP" value={latest.public_ip} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Cpu className="h-4 w-4 text-slate-400" />
              Device details
            </h2>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailWithMatch
                label="Serial number"
                reported={enrollment.serial_number}
                registered={asset.serial_number}
              />
              <Detail label="Manufacturer" value={enrollment.manufacturer} />
              <Detail label="Model" value={enrollment.model} />
              <Detail
                label="Operating system"
                value={
                  enrollment.os_name
                    ? `${enrollment.os_name}${enrollment.os_version ? ` · ${enrollment.os_version}` : ""}`
                    : null
                }
              />
              <Detail
                label="Total RAM"
                value={enrollment.total_ram_gb != null ? `${enrollment.total_ram_gb} GB` : null}
              />
              <Detail
                label="Total storage"
                value={enrollment.total_disk_gb != null ? `${enrollment.total_disk_gb} GB` : null}
              />
              <Detail label="Wi-Fi network" value={enrollment.wifi_ssid} />
              <Detail label="MAC address" value={enrollment.mac_address} />
              <Detail label="Local IP" value={enrollment.local_ip} />
              <Detail
                label="Disk encryption"
                value={
                  enrollment.disk_encrypted == null
                    ? null
                    : enrollment.disk_encrypted
                      ? "On"
                      : "Off"
                }
                tone={
                  enrollment.disk_encrypted === false ? "warn" : undefined
                }
              />
              <Detail label="Antivirus" value={enrollment.antivirus} />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              <MapPin className="h-4 w-4 text-slate-400" />
              Location
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {latest.city ?? "Unknown"}
              {latest.loc_source && (
                <span className="ml-2 text-xs text-slate-400">
                  ({latest.loc_source}
                  {latest.loc_accuracy_m ? `, ±${latest.loc_accuracy_m}m` : ""})
                </span>
              )}
              {latest.lat != null && latest.lng != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${latest.lat}&mlon=${latest.lng}#map=16/${latest.lat}/${latest.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  open full map <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {latest.lat != null && latest.lng != null && (
              <iframe
                title="Device location"
                loading="lazy"
                className="mt-3 h-56 w-full rounded-lg border border-slate-200 sm:h-64 dark:border-slate-800"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${latest.lng - 0.02}%2C${latest.lat - 0.012}%2C${latest.lng + 0.02}%2C${latest.lat + 0.012}&layer=mapnik&marker=${latest.lat}%2C${latest.lng}`}
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="h-4 w-4 text-slate-400" />
                Daily usage (last 7 days)
              </h2>
              {days.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No usage detected yet. A device counts as &quot;in use&quot;
                  when there is keyboard/mouse input (laptop) or the screen is
                  on (phone).
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-medium">Day</th>
                      <th className="pb-2 text-right font-medium">Times used</th>
                      {hasExact && (
                        <th className="pb-2 text-right font-medium">Unlocks</th>
                      )}
                      <th className="pb-2 text-right font-medium">Total time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => {
                      const exact = exactByDay.get(d.key);
                      return (
                        <tr
                          key={d.key}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-2 text-slate-700 dark:text-slate-300">
                            {d.label}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {d.sessions}
                          </td>
                          {hasExact && (
                            <td className="py-2 text-right text-slate-500">
                              {exact ? exact.unlocks : "—"}
                            </td>
                          )}
                          <td className="py-2 text-right text-slate-900 dark:text-slate-100">
                            {fmtMinutes(
                              exact && exact.screenOn > 0
                                ? exact.screenOn
                                : d.activeMinutes,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {hasExact
                  ? "Unlocks and screen time are exact (reported by the device)."
                  : `Resolution: ${cadence} min (the agent's reporting interval). Phones report exact unlocks once "usage access" is allowed in the app.`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Usage sessions
              </h2>
              {sessions.length === 0 ? (
                <p className="text-sm text-slate-500">No sessions yet.</p>
              ) : (
                <ol className="space-y-2">
                  {sessions.slice(0, 12).map((s) => (
                    <li
                      key={s.start.toISOString()}
                      className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-indigo-200 pl-3 text-sm dark:border-indigo-900"
                    >
                      <span className="text-slate-500">
                        {s.start.toLocaleDateString([], {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {fmtRange(s)}
                      </span>
                      <span className="text-xs text-slate-400">
                        ~{fmtMinutes(s.minutes)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent activity ({heartbeats.length} heartbeats)
            </h2>
            <ActivityChart data={chart} />
          </div>
        </>
      )}
    </div>
  );
}
