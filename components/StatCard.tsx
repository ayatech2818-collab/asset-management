import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "slate" | "indigo" | "green" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    indigo:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
