"use client";

import { useState } from "react";
import { ArrowLeftRight, Undo2, X } from "lucide-react";
import {
  SendForm,
  ReturnForm,
  type EmployeeOption,
} from "@/components/transfers/CustodyPanel";

// Compact transfer/return controls for one asset on the My Assets page.
export function MyAssetActions({
  assetId,
  employees,
}: {
  assetId: string;
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = useState<"transfer" | "return" | null>(null);

  if (open === null) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen("transfer")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Transfer
        </button>
        <button
          type="button"
          onClick={() => setOpen("return")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Undo2 className="h-4 w-4" />
          Return
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-slate-500">
          {open === "transfer" ? "Transfer to a colleague" : "Return to stock"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="rounded p-1 text-slate-400 hover:text-slate-600"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {open === "transfer" ? (
        <SendForm
          assetId={assetId}
          type="transfer"
          employees={employees}
          redirectTo="/my-assets"
        />
      ) : (
        <ReturnForm assetId={assetId} redirectTo="/my-assets" />
      )}
    </div>
  );
}
