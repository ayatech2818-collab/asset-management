import Link from "next/link";
import { Inbox, Boxes } from "lucide-react";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { TransferResponseButtons } from "@/components/transfers/TransferResponseButtons";
import { MyAssetActions } from "@/components/transfers/MyAssetActions";
import type { Asset, Transfer } from "@/lib/types";
import type { EmployeeOption } from "@/components/transfers/CustodyPanel";

type PendingRow = Transfer & {
  asset: { asset_tag: string; name: string } | null;
  init_p: { full_name: string } | null;
};

export default async function MyAssetsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: pendingData }, { data: assetsData }, { data: employeesData }] =
    await Promise.all([
      supabase
        .from("transfers")
        .select(
          "*, asset:asset_id(asset_tag, name), init_p:initiated_by(full_name)",
        )
        .eq("status", "pending")
        .eq("to_custodian", profile.id)
        .order("requested_at", { ascending: false }),
      supabase
        .from("assets")
        .select("*")
        .eq("current_custodian", profile.id)
        .order("asset_tag"),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .neq("id", profile.id)
        .order("full_name"),
    ]);

  const pending = (pendingData ?? []) as PendingRow[];
  const myAssets = (assetsData ?? []) as Asset[];
  const employees = (employeesData ?? []) as EmployeeOption[];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        My Assets
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Assets in your custody and handovers awaiting your acceptance.
      </p>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Inbox className="h-4 w-4" />
          Awaiting your acceptance ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Nothing waiting for you.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.asset?.asset_tag} — {t.asset?.name}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {t.type === "issue" ? "Issued" : "Transferred"} to you by{" "}
                    {t.init_p?.full_name ?? "?"} ·{" "}
                    {new Date(t.requested_at).toLocaleString()}
                    {t.remarks && <> · “{t.remarks}”</>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    By accepting you acknowledge custody and responsibility for
                    this asset.
                  </div>
                </div>
                <TransferResponseButtons
                  transferId={t.id}
                  assetId={t.asset_id}
                  canAccept
                  canReject
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Boxes className="h-4 w-4" />
          In your custody ({myAssets.length})
        </h2>
        {myAssets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            You don&apos;t hold any assets right now.
          </p>
        ) : (
          <div className="space-y-3">
            {myAssets.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">
                      {a.asset_tag}
                    </span>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {a.name}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">
                      {a.category}
                      {a.status === "pending_acceptance" && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          — handover pending
                        </span>
                      )}
                    </div>
                  </div>
                  {a.status === "assigned" && (
                    <MyAssetActions assetId={a.id} employees={employees} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Need something corrected?{" "}
        <Link href="/transfers" className="text-indigo-600 hover:underline">
          See all transfers
        </Link>
        .
      </p>
    </div>
  );
}
