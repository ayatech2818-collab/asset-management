"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { setAgentLock } from "@/lib/actions/monitoring";

// Staff-only Lock/Unlock control for a device's mobile agent. Locked → the
// employee can't open or change the agent. Unlocked → it opens freely so staff
// can manage it (re-lock before handing the phone over).
export function AgentControlPanel({
  assetId,
  locked: initialLocked,
}: {
  assetId: string;
  locked: boolean;
}) {
  const [locked, setLocked] = useState(initialLocked);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    setErr(null);
    startTransition(async () => {
      const r = await setAgentLock(assetId, !locked);
      if (r && "error" in r) setErr(r.error);
      else if (r && "success" in r) setLocked(r.locked);
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Lock className="h-4 w-4 text-slate-400" />
        Agent control (mobile)
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Lock the agent so the employee can&apos;t open it, change the
        server/token, or stop monitoring. Unlock it when you need to make
        changes, then lock it again. Monitoring keeps running either way.
      </p>

      {locked ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Locked.</strong> The employee can&apos;t open or change the
            agent on this phone.
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Unlocked.</strong> The employee can open and change the
            agent. Lock it before handing over the device.
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
          locked
            ? "bg-slate-700 hover:bg-slate-800"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : locked ? (
          <Unlock className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {locked ? "Unlock agent" : "Lock agent"}
      </button>

      {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}

      <p className="mt-3 text-xs text-slate-400">
        Takes effect when the agent app is next opened (it checks on launch), or
        within ~15&nbsp;min on the regular heartbeat.
      </p>
    </div>
  );
}
