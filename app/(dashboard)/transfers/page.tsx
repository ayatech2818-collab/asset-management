import { ArrowLeftRight, Inbox } from "lucide-react";
import Link from "next/link";
import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { TransferResponseButtons } from "@/components/transfers/TransferResponseButtons";
import { isStaff, type Transfer } from "@/lib/types";

type TransferRow = Transfer & {
  asset: { asset_tag: string; name: string } | null;
  from_p: { full_name: string } | null;
  to_p: { full_name: string } | null;
  init_p: { full_name: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  issue: "Issue",
  transfer: "Transfer",
  return: "Return",
};

const STATUS_CLS: Record<string, string> = {
  accepted: "text-green-600 dark:text-green-400",
  rejected: "text-red-600 dark:text-red-400",
  cancelled: "text-slate-400",
  pending: "text-amber-600 dark:text-amber-400",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : "—";
}

function describe(t: TransferRow): string {
  if (t.type === "issue") return `Issue to ${t.to_p?.full_name ?? "?"}`;
  if (t.type === "return")
    return `Return from ${t.from_p?.full_name ?? "?"} to stock`;
  return `${t.from_p?.full_name ?? "?"} → ${t.to_p?.full_name ?? "?"}`;
}

export default async function TransfersPage() {
  const profile = await requireProfile();
  const staff = isStaff(profile.role);
  const supabase = await createClient();

  const select =
    "*, asset:asset_id(asset_tag, name), from_p:from_custodian(full_name), to_p:to_custodian(full_name), init_p:initiated_by(full_name)";

  const [{ data: pendingData }, { data: historyData }] = await Promise.all([
    supabase
      .from("transfers")
      .select(select)
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
    supabase
      .from("transfers")
      .select(select)
      .neq("status", "pending")
      .order("responded_at", { ascending: false })
      .limit(50),
  ]);

  const pending = (pendingData ?? []) as TransferRow[];
  const history = (historyData ?? []) as TransferRow[];

  // A pending transfer "needs my action" if it's addressed to me, or it's a
  // return and I'm staff (returns are confirmed back into stock by staff).
  const needsAction = pending.filter(
    (t) => t.to_custodian === profile.id || (t.type === "return" && staff),
  );
  const waiting = pending.filter((t) => !needsAction.includes(t));

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Transfers
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Custody handovers — issues, transfers, and returns.
      </p>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Inbox className="h-4 w-4" />
          Needs your action ({needsAction.length})
        </h2>
        {needsAction.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Nothing waiting on you.
          </p>
        ) : (
          <div className="space-y-3">
            {needsAction.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {TYPE_LABEL[t.type]}:{" "}
                    <Link
                      href={`/assets/${t.asset_id}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t.asset?.asset_tag}
                    </Link>{" "}
                    — {t.asset?.name}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {describe(t)} · requested {fmt(t.requested_at)} by{" "}
                    {t.init_p?.full_name ?? "?"}
                    {t.remarks && <> · “{t.remarks}”</>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    By accepting you acknowledge{" "}
                    {t.type === "return"
                      ? "receipt of this asset back into stock."
                      : "custody and responsibility for this asset."}
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

      {waiting.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <ArrowLeftRight className="h-4 w-4" />
            Awaiting others ({waiting.length})
          </h2>
          <div className="space-y-3">
            {waiting.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {TYPE_LABEL[t.type]}:{" "}
                    <Link
                      href={`/assets/${t.asset_id}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t.asset?.asset_tag}
                    </Link>{" "}
                    — {t.asset?.name}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {describe(t)} · requested {fmt(t.requested_at)}
                  </div>
                </div>
                {(staff || t.initiated_by === profile.id) && (
                  <TransferResponseButtons
                    transferId={t.id}
                    assetId={t.asset_id}
                    canCancel
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          History
        </h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No completed transfers yet.
          </p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="space-y-3 md:hidden">
              {history.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/assets/${t.asset_id}`}
                      className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {t.asset?.asset_tag}
                    </Link>
                    <span
                      className={`text-xs font-medium capitalize ${STATUS_CLS[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {TYPE_LABEL[t.type]} · {describe(t)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {fmt(t.responded_at)}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Movement</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/assets/${t.asset_id}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {t.asset?.asset_tag}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[t.type]}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {describe(t)}
                    </td>
                    <td className={`px-4 py-3 font-medium capitalize ${STATUS_CLS[t.status]}`}>
                      {t.status}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {fmt(t.responded_at)}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
