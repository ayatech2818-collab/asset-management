"use client";

import { useActionState } from "react";
import { Loader2, Send, Undo2 } from "lucide-react";
import { initiateCustody, type TransferState } from "@/lib/actions/transfers";
import type { AssetStatus } from "@/lib/types";

export type EmployeeOption = { id: string; full_name: string; email: string };

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

// Custody action panel on the asset detail page (staff view).
export function CustodyPanel({
  assetId,
  status,
  custodianId,
  employees,
}: {
  assetId: string;
  status: AssetStatus;
  custodianId: string | null;
  employees: EmployeeOption[];
}) {
  if (status !== "in_stock" && status !== "assigned") return null;

  return (
    <div className="space-y-4">
      <SendForm
        assetId={assetId}
        type={status === "in_stock" ? "issue" : "transfer"}
        employees={employees.filter((e) => e.id !== custodianId)}
        redirectTo={`/assets/${assetId}`}
      />
      {status === "assigned" && (
        <ReturnForm assetId={assetId} redirectTo={`/assets/${assetId}`} />
      )}
      <p className="text-xs text-slate-400">
        The recipient must accept before custody changes hands.
      </p>
    </div>
  );
}

export function SendForm({
  assetId,
  type,
  employees,
  redirectTo,
}: {
  assetId: string;
  type: "issue" | "transfer";
  employees: EmployeeOption[];
  redirectTo: string;
}) {
  const action = initiateCustody.bind(null, assetId, redirectTo);
  const [state, formAction, pending] = useActionState<TransferState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          {type === "issue" ? "Issue to" : "Transfer to"}
        </div>
        <select name="to_custodian" required defaultValue="" className={input}>
          <option value="" disabled>
            Select employee…
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.email})
            </option>
          ))}
        </select>
      </div>
      <input name="remarks" placeholder="Remarks (optional)" className={input} />
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {type === "issue" ? "Issue asset" : "Send transfer"}
      </button>
    </form>
  );
}

export function ReturnForm({
  assetId,
  redirectTo,
}: {
  assetId: string;
  redirectTo: string;
}) {
  const action = initiateCustody.bind(null, assetId, redirectTo);
  const [state, formAction, pending] = useActionState<TransferState, FormData>(
    action,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
    >
      <input type="hidden" name="type" value="return" />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Undo2 className="h-4 w-4" />
        )}
        Request return to stock
      </button>
      {state?.error && (
        <span className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
