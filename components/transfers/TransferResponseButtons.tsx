"use client";

import { useState, useTransition } from "react";
import { Check, X, Ban, Loader2 } from "lucide-react";
import {
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
} from "@/lib/actions/transfers";

export function TransferResponseButtons({
  transferId,
  assetId,
  canAccept,
  canReject,
  canCancel,
}: {
  transferId: string;
  assetId: string;
  canAccept?: boolean;
  canReject?: boolean;
  canCancel?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: (id: string, assetId: string) => Promise<{ error: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await fn(transferId, assetId);
      if (result?.error) setError(result.error);
    });
  }

  const base =
    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAccept && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(acceptTransfer)}
          className={`${base} bg-green-600 text-white hover:bg-green-700`}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Accept
        </button>
      )}
      {canReject && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(rejectTransfer)}
          className={`${base} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950`}
        >
          <X className="h-4 w-4" />
          Reject
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(cancelTransfer)}
          className={`${base} border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          <Ban className="h-4 w-4" />
          Cancel
        </button>
      )}
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
