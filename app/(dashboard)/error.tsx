"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <h2 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
        Something went wrong
      </h2>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        This section failed to load. You can retry — if it keeps happening,
        refresh the page or try again shortly.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] text-slate-400">
          ref: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      >
        <RotateCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
