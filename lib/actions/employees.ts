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

export type EmployeeLoginState =
  | { error: string }
  | { success: true; email: string; password: string }
  | undefined;

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
      whatsapp: str("whatsapp"),
    })
    .eq("id", created.user.id);
  if (profErr) return { error: `User created but profile update failed: ${profErr.message}` };

  // 3. Store the plaintext password so an admin can re-share it later.
  await admin.from("employee_logins").upsert({
    profile_id: created.user.id,
    password,
    updated_at: new Date().toISOString(),
  });

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
      whatsapp: str("whatsapp"),
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

// Admin-only: change an employee's (or the admin's own) login email and/or
// password. Updates Supabase Auth via the service-role client and keeps a
// plaintext copy in employee_logins so it can be re-shared with the employee.
export async function updateEmployeeLogin(
  profileId: string,
  _prev: EmployeeLoginState,
  formData: FormData,
): Promise<EmployeeLoginState> {
  const actor = await getProfile();
  if (!actor || !isAdmin(actor.role)) return { error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return { error: "A valid email is required." };
  if (password && password.length < 6)
    return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  const updates: { email: string; password?: string } = { email };
  if (password) updates.password = password;
  const { error: authErr } = await admin.auth.admin.updateUserById(
    profileId,
    updates,
  );
  if (authErr) {
    const msg = authErr.message.includes("already")
      ? "That email is already in use."
      : authErr.message;
    return { error: msg };
  }

  // Keep the profile email in sync with the auth email.
  await admin.from("profiles").update({ email }).eq("id", profileId);

  // Persist the plaintext only when a new password was set; otherwise return
  // whatever is already stored so the WhatsApp share still has it.
  let stored = password;
  if (password) {
    await admin.from("employee_logins").upsert({
      profile_id: profileId,
      password,
      updated_at: new Date().toISOString(),
    });
  } else {
    const { data } = await admin
      .from("employee_logins")
      .select("password")
      .eq("profile_id", profileId)
      .maybeSingle();
    stored = (data?.password as string | null) ?? "";
  }

  await writeAudit(actor.id, "employee_login_updated", "profile", profileId, {
    email,
    password_changed: Boolean(password),
  });

  revalidatePath(`/employees/${profileId}`);
  return { success: true, email, password: stored };
}
