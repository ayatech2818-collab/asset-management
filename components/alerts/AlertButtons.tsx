"use client";

import { useState, useTransition } from "react";
import { CheckCheck, RefreshCw, Loader2 } from "lucide-react";
import { resolveAlert, runAlertChecks } from "@/lib/actions/alerts";

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await resolveAlert(alertId);
            if (r?.error) setError(r.error);
          })
        }
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCheck className="h-4 w-4" />
        )}
        Resolve
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function RunChecksButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await runAlertChecks();
            if (!r) return;
            setMessage(
              "error" in r
                ? r.error
                : r.created === 0
                  ? "Checks ran — nothing new."
                  : `Created ${r.created} new alert${r.created === 1 ? "" : "s"}.`,
            );
          })
        }
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Run checks now
      </button>
      {message && <span className="text-sm text-slate-500">{message}</span>}
    </div>
  );
}
