"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { isAdmin, type Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "asset_manager", "employee"];

export type EmployeeCreateState =
  | { error: string }
  | { success: true; email: string; tempPassword: string | null }
  | undefined;

export type EmployeeUpdateState = { error: string } | undefined;

export async function createEmployee(
  _prev: EmployeeCreateState,
  formData: FormData,
): Promise<EmployeeCreateState> {
  const actor = await getProfile();
  if (!actor || !isAdmin(actor.role)) return { error: "Not authorized." };

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const email = str("email")?.toLowerCase() ?? null;
  const full_name = str("full_name");
  const role = (str("role") ?? "employee") as Role;

  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return { error: "A valid email is required." };
  if (!full_name) return { error: "Full name is required." };
  if (!ROLES.includes(role)) return { error: "Invalid role." };

  let password = str("password");
  let generated = false;
  if (!password) {
    password = randomBytes(6).toString("base64url"); // 8-char temp password
    generated = true;
  }
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  // 1. Create the auth user (trigger auto-creates the profile row).
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (authErr) {
    const msg = authErr.message.includes("already")
      ? "A user with this email already exists."
      : authErr.message;
    return { error: msg };
  }

  // 2. Fill in the profile fields the trigger doesn't know about.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      full_name,
      role,
      employee_code: str("employee_code"),
      department: str("department"),
      designation: str("designation"),
    })
    .eq("id", created.user.id);
  if (profErr) return { error: `User created but profile update failed: ${profErr.message}` };

  await writeAudit(actor.id, "employee_created", "profile", created.user.id, {
    email,
    role,
  });

  revalidatePath("/employees");
  return {
    success: true,
    email,
    tempPassword: generated ? password : null,
  };
}

export async function updateEmployee(
  profileId: string,
  _prev: EmployeeUpdateState,
  formData: FormData,
): Promise<EmployeeUpdateState> {
  const actor = await getProfile();
  if (!actor || !isAdmin(actor.role)) return { error: "Not authorized." };

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const full_name = str("full_name");
  const role = (str("role") ?? "employee") as Role;
  if (!full_name) return { error: "Full name is required." };
  if (!ROLES.includes(role)) return { error: "Invalid role." };

  // Safety: an admin cannot demote or deactivate themselves (prevents locking
  // the last admin out of the system).
  const is_active = formData.get("is_active") === "on";
  if (profileId === actor.id && (role !== "admin" || !is_active)) {
    return { error: "You cannot demote or deactivate your own admin account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      role,
      employee_code: str("employee_code"),
      department: str("department"),
      designation: str("designation"),
      is_active,
    })
    .eq("id", profileId);

  if (error) return { error: error.message };

  await writeAudit(actor.id, "employee_updated", "profile", profileId, {
    role,
    is_active,
  });

  revalidatePath("/employees");
  redirect("/employees");
}
