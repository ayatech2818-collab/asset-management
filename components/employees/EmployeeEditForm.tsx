"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  updateEmployee,
  type EmployeeUpdateState,
} from "@/lib/actions/employees";
import type { Profile } from "@/lib/types";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const label =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export function EmployeeEditForm({ profile }: { profile: Profile }) {
  const action = updateEmployee.bind(null, profile.id);
  const [state, formAction, pending] = useActionState<
    EmployeeUpdateState,
    FormData
  >(action, undefined);

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800">
        {profile.email}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className={label}>
            Full name *
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            defaultValue={profile.full_name}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="role" className={label}>
            Role *
          </label>
          <select
            id="role"
            name="role"
            defaultValue={profile.role}
            className={input}
          >
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
            defaultValue={profile.employee_code ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="department" className={label}>
            Department
          </label>
          <input
            id="department"
            name="department"
            defaultValue={profile.department ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="designation" className={label}>
            Designation
          </label>
          <input
            id="designation"
            name="designation"
            defaultValue={profile.designation ?? ""}
            className={input}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={profile.is_active}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active (can sign in and hold assets)
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </button>
    </form>
  );
}
