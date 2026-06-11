"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";

export type TransferState = { error: string } | undefined;

// All validation and the actual state change live in SECURITY DEFINER
// Postgres functions (0002 migration) — atomic and DB-enforced. These actions
// are thin RPC wrappers.

function revalidateCustodyViews(assetId?: string) {
  revalidatePath("/assets");
  if (assetId) revalidatePath(`/assets/${assetId}`);
  revalidatePath("/my-assets");
  revalidatePath("/transfers");
  revalidatePath("/dashboard");
}

export async function initiateCustody(
  assetId: string,
  redirectTo: string | null,
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const actor = await getProfile();
  if (!actor) return { error: "Not authenticated." };

  const type = String(formData.get("type") ?? "");
  if (!["issue", "transfer", "return"].includes(type))
    return { error: "Invalid transfer type." };

  const to = String(formData.get("to_custodian") ?? "").trim() || null;
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  if ((type === "issue" || type === "transfer") && !to)
    return { error: "Please select an employee." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("initiate_transfer", {
    p_asset_id: assetId,
    p_type: type,
    p_to: to,
    p_remarks: remarks,
  });

  if (error) return { error: error.message };

  revalidateCustodyViews(assetId);
  if (redirectTo) redirect(redirectTo);
  return undefined;
}

export async function acceptTransfer(
  transferId: string,
  assetId: string,
): Promise<TransferState> {
  const actor = await getProfile();
  if (!actor) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_transfer", {
    p_transfer_id: transferId,
  });
  if (error) return { error: error.message };

  revalidateCustodyViews(assetId);
  return undefined;
}

export async function rejectTransfer(
  transferId: string,
  assetId: string,
): Promise<TransferState> {
  const actor = await getProfile();
  if (!actor) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_transfer", {
    p_transfer_id: transferId,
    p_action: "reject",
  });
  if (error) return { error: error.message };

  revalidateCustodyViews(assetId);
  return undefined;
}

export async function cancelTransfer(
  transferId: string,
  assetId: string,
): Promise<TransferState> {
  const actor = await getProfile();
  if (!actor) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_transfer", {
    p_transfer_id: transferId,
    p_action: "cancel",
  });
  if (error) return { error: error.message };

  revalidateCustodyViews(assetId);
  return undefined;
}
