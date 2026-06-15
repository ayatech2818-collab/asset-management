"use client";

import { useActionState, useState } from "react";
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import {
  updateEmployeeLogin,
  type EmployeeLoginState,
} from "@/lib/actions/employees";
import { credentialShareHref } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const label =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function EmployeeLoginPanel({
  profileId,
  email: initialEmail,
  whatsapp,
  password: initialPassword,
  isSelf,
}: {
  profileId: string;
  email: string;
  whatsapp: string | null;
  password: string | null;
  isSelf: boolean;
}) {
  const action = updateEmployeeLogin.bind(null, profileId);
  const [state, formAction, pending] = useActionState<
    EmployeeLoginState,
    FormData
  >(action, undefined);
  const [reveal, setReveal] = useState(false);

  // Use the latest saved values after a successful update.
  const saved = state && "success" in state ? state : null;
  const email = saved?.email ?? initialEmail;
  const password = saved?.password ?? initialPassword ?? "";

  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const waHref = credentialShareHref(email, password, whatsapp);

  return (
    <div className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <KeyRound className="h-4 w-4 text-slate-400" />
        Login &amp; credentials{isSelf && " (your account)"}
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Change the sign-in email or reset the password, then share the
        credentials with the employee on WhatsApp.
      </p>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="login-email" className={label}>
            Login email (ID)
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            defaultValue={initialEmail}
            className={input}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={label}>
            New password
          </label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={reveal ? "text" : "password"}
              minLength={6}
              autoComplete="new-password"
              placeholder="Leave blank to keep the current password"
              className={`${input} pr-10`}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {reveal ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Current shareable password */}
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
          <span className="text-slate-500">Current password: </span>
          {password ? (
            <span className="font-mono text-slate-900 dark:text-slate-100">
              {reveal ? password : "•".repeat(Math.min(password.length, 12))}
            </span>
          ) : (
            <span className="text-slate-400">
              none stored yet — set one above to enable sharing
            </span>
          )}
        </div>

        {state && "error" in state && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {saved && (
          <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Login updated.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save login
          </button>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1ebe5b]"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Share on WhatsApp
            </a>
          ) : (
            <span
              title={
                digits.length < 8
                  ? "Add a WhatsApp number on the employee's profile first."
                  : "Set a password above first."
              }
              className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 dark:bg-slate-800"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Share on WhatsApp
            </span>
          )}
        </div>
        {digits.length < 8 && (
          <p className="text-xs text-slate-400">
            Add a WhatsApp number (with country code) on the employee&apos;s
            profile above to enable sharing.
          </p>
        )}
      </form>
    </div>
  );
}
