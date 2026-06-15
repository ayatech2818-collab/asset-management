import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  ResolveAlertButton,
  RunChecksButton,
} from "@/components/alerts/AlertButtons";
import { isStaff, type Alert } from "@/lib/types";

type AlertRow = Alert & {
  asset: { asset_tag: string; name: string } | null;
  resolver: { full_name: string } | null;
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  med: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const TYPE_LABEL: Record<string, string> = {
  WARRANTY_EXPIRING: "Warranty expiring",
  WARRANTY_EXPIRED: "Warranty expired",
  CUSTODY_PENDING_3D: "Stuck transfer",
  DEVICE_OFFLINE: "Device offline",
  LOW_BATTERY: "Low battery",
  LOW_DISK: "Low disk",
  UNAUTHORIZED_USER: "Unauthorized user",
  SERIAL_MISMATCH: "Serial mismatch",
};

export default async function AlertsPage() {
  const profile = await requireProfile();
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const select =
    "*, asset:asset_id(asset_tag, name), resolver:resolved_by(full_name)";

  const [{ data: activeData }, { data: resolvedData }] = await Promise.all([
    supabase
      .from("alerts")
      .select(select)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select(select)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  const active = (activeData ?? []) as AlertRow[];
  const resolved = (resolvedData ?? []) as AlertRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Alerts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {active.length} active alert{active.length === 1 ? "" : "s"}
          </p>
        </div>
        {staff && <RunChecksButton />}
      </div>

      <section className="mt-6">
        {active.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="mt-2 text-sm text-slate-500">
              No active alerts — everything looks healthy.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <Bell className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[a.severity]}`}
                      >
                        {a.severity}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {TYPE_LABEL[a.type] ?? a.type}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {a.message}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      <Link
                        href={`/assets/${a.asset_id}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {a.asset?.asset_tag}
                      </Link>{" "}
                      · {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {staff && <ResolveAlertButton alertId={a.id} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recently resolved
          </h2>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {resolved.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  {a.message}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono">{a.asset?.asset_tag}</span>
                  <span>· by {a.resolver?.full_name ?? "—"}</span>
                  <span>
                    ·{" "}
                    {a.resolved_at
                      ? new Date(a.resolved_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Resolved by</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {a.message}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.asset?.asset_tag}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {a.resolver?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.resolved_at
                        ? new Date(a.resolved_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
