import Link from "next/link";
import { MapPin, Laptop, Smartphone, Monitor as MonitorIcon } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { DeviceEnrollment, Heartbeat } from "@/lib/types";

type EnrollmentRow = DeviceEnrollment & {
  asset: {
    asset_tag: string;
    name: string;
    category: string;
    custodian: { full_name: string } | null;
  } | null;
};

const PLATFORM_ICON: Record<string, typeof Laptop> = {
  windows: Laptop,
  mac: Laptop,
  android: Smartphone,
  ios: Smartphone,
};

function activity(idle: number | null): { label: string; cls: string } {
  if (idle == null) return { label: "—", cls: "text-slate-400" };
  if (idle < 5)
    return { label: "Active", cls: "text-green-600 dark:text-green-400" };
  if (idle < 30)
    return { label: "Idle", cls: "text-amber-600 dark:text-amber-400" };
  return { label: `Idle ${idle}m`, cls: "text-slate-500" };
}

export default async function MonitoringPage() {
  const supabase = await createClient();

  // Role guard runs alongside the data fetch. latest_heartbeats returns exactly
  // one (newest) row per device via a single indexed query — no 400-row fetch
  // or JS de-duplication.
  const [, { data: enrollData }, { data: hbData }] = await Promise.all([
    requireStaff(),
    supabase
      .from("device_enrollments")
      .select(
        "*, asset:asset_id(asset_tag, name, category, custodian:current_custodian(full_name))",
      )
      .order("online_status", { ascending: true }),
    supabase.from("latest_heartbeats").select("*"),
  ]);

  const enrollments = (enrollData ?? []) as EnrollmentRow[];
  const latest = new Map<string, Heartbeat>();
  for (const hb of (hbData ?? []) as Heartbeat[]) latest.set(hb.asset_id, hb);

  const online = enrollments.filter((e) => e.online_status === "online").length;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Monitoring
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {enrollments.length} monitored device
        {enrollments.length === 1 ? "" : "s"} · {online} online
      </p>

      {enrollments.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <MonitorIcon className="h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            No devices are being monitored yet.
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Open a laptop or phone asset and click{" "}
            <span className="font-medium">Enroll device</span> to generate an
            agent token, then install the agent on that device.
          </p>
          <Link
            href="/assets?category=laptop"
            className="mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Go to laptops
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const hb = latest.get(e.asset_id);
            const Icon = PLATFORM_ICON[e.platform] ?? Laptop;
            const act = activity(hb?.idle_minutes ?? null);
            return (
              <Link
                key={e.id}
                href={`/monitoring/${e.asset_id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="font-mono text-xs text-slate-500">
                        {e.asset?.asset_tag}
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {e.asset?.name}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.online_status === "online"
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        e.online_status === "online"
                          ? "bg-green-500"
                          : "bg-slate-400"
                      }`}
                    />
                    {e.online_status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Activity</span>
                    <div className={`font-medium ${act.cls}`}>{act.label}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Battery</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {hb?.battery_pct != null ? `${hb.battery_pct}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">User</span>
                    <div className="truncate font-medium text-slate-700 dark:text-slate-300">
                      {hb?.logged_in_user ?? "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Location</span>
                    <div className="flex items-center gap-1 truncate font-medium text-slate-700 dark:text-slate-300">
                      {hb?.city ? (
                        <>
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{hb.city}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Held by {e.asset?.custodian?.full_name ?? "—"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
