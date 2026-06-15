import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { EmployeeCreateForm } from "@/components/employees/EmployeeCreateForm";

export default async function NewEmployeePage() {
  await requireAdmin();

  return (
    <div>
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Add employee
      </h1>
      <EmployeeCreateForm />
    </div>
  );
}
