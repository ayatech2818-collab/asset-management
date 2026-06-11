"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Radio, Copy, Check, Power } from "lucide-react";
import {
  enrollDevice,
  unenrollDevice,
  type EnrollState,
} from "@/lib/actions/monitoring";
import type { DeviceEnrollment } from "@/lib/types";

function InstallInstructions({
  token,
  platform,
}: {
  token: string;
  platform: string;
}) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://YOUR-APP";
  const cmd = `powershell -ExecutionPolicy Bypass -File .\\install-agent.ps1 -Token ${token} -Server ${origin}`;

  return (
    <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <p className="text-sm font-medium text-green-800 dark:text-green-200">
        Device enrolled. Token shown once — use it to install the agent.
      </p>
      <div>
        <div className="mb-1 text-xs text-slate-500">Device token</div>
        <code className="block break-all rounded bg-white px-2 py-1 font-mono text-xs dark:bg-slate-900">
          {token}
        </code>
      </div>
      {platform === "windows" && (
        <div>
          <div className="mb-1 text-xs text-slate-500">
            On the laptop, in an Admin PowerShell:
          </div>
          <div className="flex items-start gap-2">
            <code className="block flex-1 break-all rounded bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100">
              {cmd}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(cmd);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded p-1.5 text-slate-400 hover:text-slate-600"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
      {platform !== "windows" && (
        <p className="text-xs text-slate-500">
          Install the {platform} agent and enter this token when prompted.
        </p>
      )}
    </div>
  );
}

export function EnrollPanel({
  assetId,
  enrollment,
}: {
  assetId: string;
  enrollment: DeviceEnrollment | null;
}) {
  const action = enrollDevice.bind(null, assetId);
  const [state, formAction, pending] = useActionState<EnrollState, FormData>(
    action,
    undefined,
  );
  const [unenrollPending, startUnenroll] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Freshly enrolled (or re-enrolled) — show the token + install command.
  if (state && "token" in state) {
    return <InstallInstructions token={state.token} platform={state.platform} />;
  }

  if (enrollment) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              enrollment.online_status === "online"
                ? "bg-green-500"
                : "bg-slate-300"
            }`}
          />
          <span className="capitalize text-slate-700 dark:text-slate-300">
            {enrollment.online_status}
          </span>
          <span className="text-slate-400">·</span>
          <span className="capitalize text-slate-500">
            {enrollment.platform}
          </span>
          {enrollment.last_seen && (
            <span className="text-xs text-slate-400">
              last seen {new Date(enrollment.last_seen).toLocaleString()}
            </span>
          )}
        </div>

        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="platform" value={enrollment.platform} />
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5" />
            )}
            Re-issue token
          </button>
          <button
            type="button"
            disabled={unenrollPending}
            onClick={() =>
              startUnenroll(async () => {
                const r = await unenrollDevice(assetId);
                if (r?.error) setErr(r.error);
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {unenrollPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            Stop monitoring
          </button>
        </form>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    );
  }

  // Not yet enrolled.
  return (
    <form action={formAction} className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Platform</label>
        <select
          name="platform"
          defaultValue="windows"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="windows">Windows</option>
          <option value="mac">macOS</option>
          <option value="android">Android</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Radio className="h-4 w-4" />
        )}
        Enroll device
      </button>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
