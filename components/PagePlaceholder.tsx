import type { LucideIcon } from "lucide-react";

export function PagePlaceholder({
  title,
  description,
  phase,
  icon: Icon,
}: {
  title: string;
  description: string;
  phase: string;
  icon: LucideIcon;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500 dark:bg-slate-800">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
          Coming in {phase}
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500">
          The foundation is ready. This module will be built out in a later
          phase of the roadmap.
        </p>
      </div>
    </div>
  );
}
