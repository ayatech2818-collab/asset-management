import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ActivityChart, type ActivityPoint } from "@/components/monitoring/ActivityChart";
import type { Asset, DeviceEnrollment, Heartbeat } from "@/lib/types";

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

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  await requireStaff();
  const { assetId } = await params;
  const supabase = await createClient();

  const [{ data: assetData }, { data: enrollData }, { data: hbData }] =
    await Promise.all([
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
        .order("reported_at", { ascending: false })
        .limit(100),
    ]);

  const asset = assetData as Asset | null;
  const enrollment = enrollData as DeviceEnrollment | null;
  if (!asset || !enrollment) notFound();

  const heartbeats = (hbData ?? []) as Heartbeat[];
  const latest = heartbeats[0] ?? null;

  // Oldest → newest for the chart.
  const chart: ActivityPoint[] = [...heartbeats]
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
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
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
                  href={`https://www.openstreetmap.org/?mlat=${latest.lat}&mlon=${latest.lng}#map=13/${latest.lat}/${latest.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  view map <ExternalLink className="h-3 w-3" />
                </a>
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
