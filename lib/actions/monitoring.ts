"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { isStaff, type Platform } from "@/lib/types";

export type EnrollState =
  | { error: string }
  | { token: string; platform: string }
  | undefined;

export async function enrollDevice(
  assetId: string,
  _prev: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const actor = await getProfile();
  if (!actor || !isStaff(actor.role)) return { error: "Not authorized." };

  const platform = String(formData.get("platform") ?? "") as Platform;
  if (!["windows", "mac", "android", "ios"].includes(platform))
    return { error: "Select a platform." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enroll_device", {
    p_asset_id: assetId,
    p_platform: platform,
  });
  if (error) return { error: error.message };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/monitoring");
  return { token: data as string, platform };
}

export type AgentLockState =
  | { error: string }
  | { success: true; locked: boolean }
  | undefined;

// Admin lock/unlock for a device's mobile agent. Locked → the employee can't
// open or change the agent; unlocked → it opens freely for staff to manage.
export async function setAgentLock(
  assetId: string,
  locked: boolean,
): Promise<AgentLockState> {
  const actor = await getProfile();
  if (!actor || !isStaff(actor.role)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_agent_lock", {
    p_asset_id: assetId,
    p_locked: locked,
  });
  if (error) return { error: error.message };

  revalidatePath(`/monitoring/${assetId}`);
  return { success: true, locked };
}

export async function unenrollDevice(
  assetId: string,
): Promise<{ error: string } | undefined> {
  const actor = await getProfile();
  if (!actor || !isStaff(actor.role)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unenroll_device", {
    p_asset_id: assetId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/monitoring");
  return undefined;
}
