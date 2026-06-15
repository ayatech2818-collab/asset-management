"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, Copy } from "lucide-react";
import {
  createEmployee,
  type EmployeeCreateState,
} from "@/lib/actions/employees";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const label =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function EmployeeCreateForm() {
  const [state, formAction, pending] = useActionState<
    EmployeeCreateState,
    FormData
  >(createEmployee, undefined);

  if (state && "success" in state) {
    return (
      <div className="max-w-xl rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Employee created</span>
        </div>
        <p className="mt-2 text-sm text-green-800 dark:text-green-200">
          <strong>{state.email}</strong> can now sign in.
        </p>
        {state.tempPassword && (
          <div className="mt-3 rounded-lg border border-green-300 bg-white p-3 dark:border-green-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">
              Temporary password — share it with the employee now. It will not
              be shown again:
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                {state.tempPassword}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(state.tempPassword!)}
                title="Copy"
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <Link
          href="/employees"
          className="mt-4 inline-block text-sm font-medium text-green-700 underline dark:text-green-300"
        >
          Back to employees
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className={label}>
            Full name *
          </label>
          <input id="full_name" name="full_name" required className={input} />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email *
          </label>
          <input id="email" name="email" type="email" required className={input} />
        </div>
        <div>
          <label htmlFor="role" className={label}>
            Role *
          </label>
          <select id="role" name="role" defaultValue="employee" className={input}>
            <option value="employee">Employee</option>
            <option value="asset_manager">Asset Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label htmlFor="employee_code" className={label}>
            Employee code
          </label>
          <input
            id="employee_code"
            name="employee_code"
            placeholder="AYT-EMP-002"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="department" className={label}>
            Department
          </label>
          <input id="department" name="department" className={input} />
        </div>
        <div>
          <label htmlFor="designation" className={label}>
            Designation
          </label>
          <input id="designation" name="designation" className={input} />
        </div>
        <div>
          <label htmlFor="whatsapp" className={label}>
            WhatsApp number
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="text"
          placeholder="Leave blank to auto-generate"
          className={input}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create employee
      </button>
    </form>
  );
}
