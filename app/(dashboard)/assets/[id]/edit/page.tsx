import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AssetForm } from "@/components/assets/AssetForm";
import { updateAsset } from "@/lib/actions/assets";
import type { Asset } from "@/lib/types";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = await createClient();
  const { data: asset } = (await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single()) as { data: Asset | null };

  if (!asset) notFound();

  const action = updateAsset.bind(null, asset.id);

  return (
    <div>
      <Link
        href={`/assets/${asset.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {asset.asset_tag}
      </Link>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Edit asset
      </h1>
      <AssetForm action={action} asset={asset} submitLabel="Save changes" />
    </div>
  );
}
