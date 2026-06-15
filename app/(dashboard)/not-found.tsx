import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <Compass className="h-8 w-8 text-slate-400" />
      <h2 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
        Not found
      </h2>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        The page or record you&apos;re looking for doesn&apos;t exist or may
        have been removed.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
