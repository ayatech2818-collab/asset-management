import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  PackageOpen,
  Bell,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import {
  CategoryPie,
  StatusBars,
  type ChartDatum,
} from "@/components/charts/DashboardCharts";
import { isStaff, type Transfer } from "@/lib/types";

type RecentTransfer = Transfer & {
  asset: { asset_tag: string; name: string } | null;
  to_p: { full_name: string } | null;
  from_p: { full_name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  assigned: "Assigned",
  pending_acceptance: "Pending",
  under_repair: "Repair",
  retired: "Retired",
  lost: "Lost",
};

function tally(rows: { [k: string]: string }[], key: string): ChartDatum[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[key] ?? "unknown";
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const [assetsRes, transfersRes, alertsRes, myPendingRes] = await Promise.all([
    supabase.from("assets").select("category, status"),
    supabase
      .from("transfers")
      .select(
        "*, asset:asset_id(asset_tag, name), to_p:to_custodian(full_name), from_p:from_custodian(full_name)",
      )
      .order("requested_at", { ascending: false })
      .limit(5),
    supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("transfers")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("to_custodian", profile.id),
  ]);

  const assetRows = (assetsRes.data ?? []) as { category: string; status: string }[];
  const recent = (transfersRes.data ?? []) as RecentTransfer[];
  const activeAlerts = alertsRes.count ?? 0;
  const myPending = myPendingRes.count ?? 0;

  const total = assetRows.length;
  const assigned = assetRows.filter((a) => a.status === "assigned").length;
  const inStock = assetRows.filter((a) => a.status === "in_stock").length;

  const byCategory = tally(assetRows, "category").map((d) => ({
    ...d,
    name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
  }));
  const byStatus = tally(assetRows, "status").map((d) => ({
    ...d,
    name: STATUS_LABEL[d.name] ?? d.name,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Welcome back, {profile.full_name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {staff
          ? "Overview of your organisation's assets."
          : "Overview of the assets in your custody."}
      </p>

      {myPending > 0 && (
        <Link
          href="/my-assets"
          className="mt-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <span className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            {myPending} handover{myPending === 1 ? "" : "s"} waiting for your
            acceptance
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total assets" value={total} icon={Boxes} tone="indigo" />
        <StatCard label="Assigned" value={assigned} icon={CheckCircle2} tone="green" />
        <StatCard label="In stock" value={inStock} icon={PackageOpen} tone="slate" />
        <StatCard
          label="Active alerts"
          value={activeAlerts}
          icon={Bell}
          tone={activeAlerts > 0 ? "amber" : "slate"}
        />
      </div>

      {total > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Assets by category
            </h2>
            <CategoryPie data={byCategory} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Assets by status
            </h2>
            <StatusBars data={byStatus} />
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent custody activity
          </h2>
          <Link
            href="/transfers"
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No transfers yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline gap-x-2 text-sm"
              >
                <span className="font-mono text-xs text-slate-400">
                  {new Date(t.requested_at).toLocaleDateString()}
                </span>
                <Link
                  href={`/assets/${t.asset_id}`}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {t.asset?.asset_tag}
                </Link>
                <span className="text-slate-600 dark:text-slate-400">
                  {t.type === "issue" && `issued to ${t.to_p?.full_name ?? "?"}`}
                  {t.type === "transfer" &&
                    `${t.from_p?.full_name ?? "?"} → ${t.to_p?.full_name ?? "?"}`}
                  {t.type === "return" &&
                    `returned by ${t.from_p?.full_name ?? "?"}`}
                </span>
                <span
                  className={`text-xs font-medium capitalize ${
                    t.status === "accepted"
                      ? "text-green-600 dark:text-green-400"
                      : t.status === "pending"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-400"
                  }`}
                >
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
