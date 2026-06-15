import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeeEditForm } from "@/components/employees/EmployeeEditForm";
import { EmployeeLoginPanel } from "@/components/employees/EmployeeLoginPanel";
import type { Profile } from "@/lib/types";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single()) as { data: Profile | null };

  if (!profile) notFound();

  // The shareable plaintext password lives in the locked-down employee_logins
  // table — only readable with the service-role client (we're already inside an
  // admin-only route).
  const admin = createAdminClient();
  const { data: login } = await admin
    .from("employee_logins")
    .select("password")
    .eq("profile_id", id)
    .maybeSingle();
  const storedPassword = (login?.password as string | null) ?? null;

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
        Edit employee
      </h1>
      <EmployeeEditForm profile={profile} />
      <EmployeeLoginPanel
        profileId={profile.id}
        email={profile.email}
        whatsapp={profile.whatsapp}
        password={storedPassword}
        isSelf={profile.id === actor.id}
      />
    </div>
  );
}
