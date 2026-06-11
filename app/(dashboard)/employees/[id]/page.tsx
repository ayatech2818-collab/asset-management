import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { EmployeeEditForm } from "@/components/employees/EmployeeEditForm";
import type { Profile } from "@/lib/types";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single()) as { data: Profile | null };

  if (!profile) notFound();

  return (
    <div>
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Edit employee
      </h1>
      <EmployeeEditForm profile={profile} />
    </div>
  );
}
