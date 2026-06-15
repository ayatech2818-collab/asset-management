"use client";

import { useActionState } from "react";
import { Loader2, CheckCircle2, BatteryLow, HardDrive } from "lucide-react";
import {
  updateAlertSettings,
  type SettingsState,
} from "@/lib/actions/settings";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const label =
  "mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300";

export function AlertSettingsForm({
  battery,
  disk,
}: {
  battery: number;
  disk: number;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateAlertSettings,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="low_battery_pct" className={label}>
            <BatteryLow className="h-4 w-4 text-slate-400" />
            Low battery (%)
          </label>
          <input
            id="low_battery_pct"
            name="low_battery_pct"
            type="number"
            min={1}
            max={100}
            step={1}
            required
            defaultValue={battery}
            className={input}
          />
          <p className="mt-1 text-xs text-slate-400">
            Raise a Low battery alert below this charge (when not charging).
          </p>
        </div>
        <div>
          <label htmlFor="low_disk_gb" className={label}>
            <HardDrive className="h-4 w-4 text-slate-400" />
            Low disk (GB free)
          </label>
          <input
            id="low_disk_gb"
            name="low_disk_gb"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={disk}
            className={input}
          />
          <p className="mt-1 text-xs text-slate-400">
            Raise a Low disk alert below this much free space.
          </p>
        </div>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </button>
    </form>
  );
}
