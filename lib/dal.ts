import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isStaff, isAdmin, type Profile } from "@/lib/types";

// Data Access Layer — the single place auth + the current profile are resolved.
// `cache` dedupes these within a single render pass.

export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

// Staff = admin or asset_manager. Non-staff are bounced to their dashboard.
export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) redirect("/dashboard");
  return profile;
}
