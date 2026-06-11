import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const ROLE_BADGE: Record<string, string> = {
  admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  asset_manager:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  employee:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  employee: "Employee",
};

export default async function EmployeesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  const employees = (data ?? []) as Profile[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Employees
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {employees.length} user{employees.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/employees/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add employee
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {p.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {p.email}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {p.employee_code ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {p.department ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[p.role]}`}
                  >
                    {ROLE_LABEL[p.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.is_active ? (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-500">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/employees/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
