import {
  Boxes,
  IndianRupee,
  UserCheck,
  MapPin,
  Download,
  FileSpreadsheet,
  History,
  ArrowLeftRight,
  ScrollText,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";

const EXPORTS: {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    key: "assets",
    title: "Asset registry",
    description:
      "Every asset with category, serial number, status, value, warranty, and current custodian.",
    icon: FileSpreadsheet,
  },
  {
    key: "custody",
    title: "Custody history",
    description:
      "The full chain-of-custody ledger — who held what, from when to when, and why it ended.",
    icon: History,
  },
  {
    key: "transfers",
    title: "Transfer log",
    description:
      "All issue / transfer / return requests with their status and response times.",
    icon: ArrowLeftRight,
  },
  {
    key: "audit",
    title: "Audit log",
    description:
      "Every administrative action — asset edits, enrollments, transfers — with actor and timestamp.",
    icon: ScrollText,
  },
  {
    key: "monitoring",
    title: "Monitoring snapshot",
    description:
      "Enrolled devices with their latest telemetry: online status, battery, disk, location.",
    icon: Activity,
  },
];

export default async function ReportsPage() {
  await requireStaff();
  const supabase = await createClient();

  const { data } = await supabase
    .from("assets")
    .select("category, status, purchase_price, is_monitored");
  const assets = data ?? [];

  const total = assets.length;
  const assigned = assets.filter((a) => a.status === "assigned").length;
  const monitored = assets.filter((a) => a.is_monitored).length;
  const totalValue = assets.reduce(
    (sum, a) => sum + (a.purchase_price ?? 0),
    0,
  );

  const byCategory = new Map<string, { count: number; value: number }>();
  for (const a of assets) {
    const entry = byCategory.get(a.category) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += a.purchase_price ?? 0;
    byCategory.set(a.category, entry);
  }
  const categories = [...byCategory.entries()].sort(
    (x, y) => y[1].value - x[1].value,
  );

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Reports
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Registry summaries and CSV exports for audits, insurance, and finance.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total assets" value={total} icon={Boxes} tone="indigo" />
        <StatCard
          label="Total purchase value"
          value={totalValue.toLocaleString("en-IN")}
          icon={IndianRupee}
          tone="green"
        />
        <StatCard label="Assigned" value={assigned} icon={UserCheck} tone="amber" />
        <StatCard label="Monitored devices" value={monitored} icon={MapPin} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Value by category
          </h2>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">No assets yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                  <th className="pb-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(([cat, { count, value }]) => (
                  <tr
                    key={cat}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="py-2 capitalize text-slate-700 dark:text-slate-300">
                      {cat}
                    </td>
                    <td className="py-2 text-right text-slate-500">{count}</td>
                    <td className="py-2 text-right text-slate-900 dark:text-slate-100">
                      {value.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            CSV exports
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EXPORTS.map(({ key, title, description, icon: Icon }) => (
              <div
                key={key}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-xs text-slate-500">{description}</p>
                <a
                  href={`/reports/export/${key}`}
                  download
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
