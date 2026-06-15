import { Boxes } from "lucide-react";

export function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Boxes className="h-5 w-5" />
      </div>
      <span className="font-semibold text-slate-900 dark:text-slate-100">
        AssetHub
      </span>
    </div>
  );
}
