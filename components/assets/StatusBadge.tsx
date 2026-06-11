import type { AssetStatus } from "@/lib/types";

const STYLES: Record<AssetStatus, { label: string; cls: string }> = {
  in_stock: {
    label: "In stock",
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  assigned: {
    label: "Assigned",
    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  pending_acceptance: {
    label: "Pending acceptance",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  under_repair: {
    label: "Under repair",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  retired: {
    label: "Retired",
    cls: "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  },
  lost: {
    label: "Lost",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  const s = STYLES[status] ?? STYLES.in_stock;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
