import { SlidersHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AlertSettingsForm } from "@/components/settings/AlertSettingsForm";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("alert_settings")
    .select("low_battery_pct, low_disk_gb")
    .eq("id", 1)
    .maybeSingle();

  const battery = (data?.low_battery_pct as number) ?? 15;
  const disk = Number(data?.low_disk_gb ?? 10);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        <SlidersHorizontal className="h-6 w-6 text-slate-400" />
        Settings
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Thresholds that trigger device alerts. Changes apply within a minute.
      </p>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Alert thresholds
        </h2>
        <AlertSettingsForm battery={battery} disk={disk} />
      </section>
    </div>
  );
}
