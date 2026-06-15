import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { AssetForm } from "@/components/assets/AssetForm";
import { createAsset } from "@/lib/actions/assets";

export default async function NewAssetPage() {
  await requireStaff();

  return (
    <div>
      <Link
        href="/assets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to assets
      </Link>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        New asset
      </h1>
      <AssetForm action={createAsset} submitLabel="Create asset" />
    </div>
  );
}
