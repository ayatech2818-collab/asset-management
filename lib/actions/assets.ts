"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { isStaff } from "@/lib/types";

export type ActionState = { error: string } | undefined;

const CATEGORIES = [
  "laptop",
  "mobile",
  "monitor",
  "vehicle",
  "furniture",
  "tool",
  "other",
];
const CONDITIONS = ["new", "good", "fair", "damaged"];
// Statuses settable by hand. assigned/pending_acceptance are owned by the
// custody workflow (Phase 3) and can never be set from the asset form.
const MANUAL_STATUSES = ["in_stock", "under_repair", "retired", "lost"];

type AssetValues = {
  asset_tag: string;
  name: string;
  category: string;
  condition: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  vendor: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  purchase_price: number | null;
  notes: string | null;
};

type ParseResult =
  | { ok: false; error: string }
  | { ok: true; values: AssetValues };

function parseAssetForm(formData: FormData): ParseResult {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const asset_tag = str("asset_tag");
  const name = str("name");
  const category = str("category") ?? "other";
  const condition = str("condition") ?? "good";

  if (!asset_tag) return { ok: false, error: "Asset tag is required." };
  if (!name) return { ok: false, error: "Name is required." };
  if (!CATEGORIES.includes(category))
    return { ok: false, error: "Invalid category." };
  if (!CONDITIONS.includes(condition))
    return { ok: false, error: "Invalid condition." };

  const priceRaw = str("purchase_price");
  const purchase_price = priceRaw === null ? null : Number(priceRaw);
  if (purchase_price !== null && (Number.isNaN(purchase_price) || purchase_price < 0))
    return { ok: false, error: "Purchase price must be a positive number." };

  return {
    ok: true,
    values: {
      asset_tag,
      name,
      category,
      condition,
      brand: str("brand"),
      model: str("model"),
      serial_number: str("serial_number"),
      location: str("location"),
      vendor: str("vendor"),
      purchase_date: str("purchase_date"),
      warranty_expiry: str("warranty_expiry"),
      purchase_price,
      notes: str("notes"),
    },
  };
}

async function requireStaffActor() {
  const profile = await getProfile();
  if (!profile || !isStaff(profile.role)) return null;
  return profile;
}

export async function createAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireStaffActor();
  if (!actor) return { error: "Not authorized." };

  const parsed = parseAssetForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({ ...parsed.values, status: "in_stock", created_by: actor.id })
    .select("id, asset_tag")
    .single();

  if (error) {
    if (error.code === "23505")
      return { error: `Asset tag "${parsed.values.asset_tag}" already exists.` };
    return { error: error.message };
  }

  await writeAudit(actor.id, "asset_created", "asset", data.id, {
    asset_tag: data.asset_tag,
  });

  revalidatePath("/assets");
  redirect(`/assets/${data.id}`);
}

export async function updateAsset(
  assetId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireStaffActor();
  if (!actor) return { error: "Not authorized." };

  const parsed = parseAssetForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  // Status can only be changed manually while the asset is not in a
  // custody-controlled state.
  const { data: current } = await supabase
    .from("assets")
    .select("status")
    .eq("id", assetId)
    .single();
  if (!current) return { error: "Asset not found." };

  const requestedStatus = String(formData.get("status") ?? "").trim();
  const custodyControlled = ["assigned", "pending_acceptance"].includes(
    current.status,
  );
  const update: Record<string, unknown> = {
    ...parsed.values,
    updated_at: new Date().toISOString(),
  };
  if (!custodyControlled && MANUAL_STATUSES.includes(requestedStatus)) {
    update.status = requestedStatus;
  }

  const { error } = await supabase
    .from("assets")
    .update(update)
    .eq("id", assetId);

  if (error) {
    if (error.code === "23505")
      return { error: `Asset tag "${parsed.values.asset_tag}" already exists.` };
    return { error: error.message };
  }

  await writeAudit(actor.id, "asset_updated", "asset", assetId, {
    asset_tag: parsed.values.asset_tag,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  redirect(`/assets/${assetId}`);
}

export async function deleteAsset(assetId: string): Promise<ActionState> {
  const actor = await requireStaffActor();
  if (!actor) return { error: "Not authorized." };

  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("asset_tag, status")
    .eq("id", assetId)
    .single();
  if (!asset) return { error: "Asset not found." };

  // Deleting an assigned asset would orphan a live custody — block it.
  if (["assigned", "pending_acceptance"].includes(asset.status)) {
    return { error: "Cannot delete an asset that is in someone's custody." };
  }

  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) return { error: error.message };

  await writeAudit(actor.id, "asset_deleted", "asset", assetId, {
    asset_tag: asset.asset_tag,
  });

  revalidatePath("/assets");
  redirect("/assets");
}
