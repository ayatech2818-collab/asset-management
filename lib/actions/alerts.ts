"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { isStaff } from "@/lib/types";

export type AlertActionState = { error: string } | undefined;
export type RunChecksState =
  | { error: string }
  | { created: number }
  | undefined;

export async function resolveAlert(
  alertId: string,
): Promise<AlertActionState> {
  const actor = await getProfile();
  if (!actor || !isStaff(actor.role)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_alert", {
    p_alert_id: alertId,
  });
  if (error) return { error: error.message };

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return undefined;
}

export async function runAlertChecks(): Promise<RunChecksState> {
  const actor = await getProfile();
  if (!actor || !isStaff(actor.role)) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_alert_checks");
  if (error) return { error: error.message };

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { created: (data as number) ?? 0 };
}
