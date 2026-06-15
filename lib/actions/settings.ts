"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { isAdmin } from "@/lib/types";

export type SettingsState =
  | { error: string }
  | { success: true }
  | undefined;

export async function updateAlertSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await getProfile();
  if (!actor || !isAdmin(actor.role)) return { error: "Not authorized." };

  const battery = Number(formData.get("low_battery_pct"));
  const disk = Number(formData.get("low_disk_gb"));

  if (!Number.isFinite(battery) || battery < 1 || battery > 100) {
    return { error: "Battery threshold must be between 1 and 100." };
  }
  if (!Number.isFinite(disk) || disk < 0) {
    return { error: "Disk threshold must be 0 or more." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_alert_settings", {
    p_low_battery_pct: Math.round(battery),
    p_low_disk_gb: disk,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
