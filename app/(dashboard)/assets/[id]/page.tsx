import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, History } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/assets/StatusBadge";
import { DeleteAssetButton } from "@/components/assets/DeleteAssetButton";
import {
  CustodyPanel,
  type EmployeeOption,
} from "@/components/transfers/CustodyPanel";
import { TransferResponseButtons } from "@/components/transfers/TransferResponseButtons";
import { EnrollPanel } from "@/components/monitoring/EnrollPanel";
import type {
  Asset,
  AssetStatus,
  CustodyRecord,
  Transfer,
  DeviceEnrollment,
} from "@/lib/types";

type AssetDetail = Asset & {
  custodian: { full_name: string; email: string } | null;
};
type CustodyRow = CustodyRecord & {
  custodian: { full_name: string } | null;
  issuer: { full_name: string } | null;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">
        {value ?? "—"}
      </div>
    </div>
  );
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const supabase = await createClient();
  const { data: asset } = (await supabase
    .from("assets")
    .select("*, custodian:current_custodian(full_name, email)")
    .eq("id", id)
    .single()) as { data: AssetDetail | null };

  if (!asset) notFound();

  const [
    { data: custody },
    { data: employeesData },
    { data: pendingData },
    { data: enrollData },
  ] = await Promise.all([
    supabase
      .from("custody_records")
      .select(
        "*, custodian:custodian_id(full_name), issuer:issued_by(full_name)",
      )
      .eq("asset_id", id)
      .order("started_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("transfers")
      .select("*, to_p:to_custodian(full_name)")
      .eq("asset_id", id)
      .eq("status", "pending")
      .limit(1),
    supabase
      .from("device_enrollments")
      .select("*")
      .eq("asset_id", id)
      .maybeSingle(),
  ]);

  const custodyRows = (custody ?? []) as CustodyRow[];
  const employees = (employeesData ?? []) as EmployeeOption[];
  const pendingTransfer = ((pendingData ?? [])[0] ?? null) as
    | (Transfer & { to_p: { full_name: string } | null })
    | null;
  const enrollment = (enrollData ?? null) as DeviceEnrollment | null;
  const monitorable = ["laptop", "mobile", "monitor", "other"].includes(
    asset.category,
  );

  return (
    <div>
      <Link
        href="/assets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to assets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {asset.name}
            </h1>
            <StatusBadge status={asset.status as AssetStatus} />
          </div>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {asset.asset_tag}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/assets/${asset.id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <DeleteAssetButton assetId={asset.id} assetTag={asset.asset_tag} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Details
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Category" value={<span className="capitalize">{asset.category}</span>} />
            <Field label="Brand" value={asset.brand} />
            <Field label="Model" value={asset.model} />
            <Field label="Serial number" value={asset.serial_number} />
            <Field label="Condition" value={<span className="capitalize">{asset.condition}</span>} />
            <Field label="Location" value={asset.location} />
            <Field label="Vendor" value={asset.vendor} />
            <Field label="Purchase date" value={fmtDate(asset.purchase_date)} />
            <Field
              label="Purchase price"
              value={asset.purchase_price != null ? asset.purchase_price.toLocaleString() : "—"}
            />
            <Field label="Warranty expiry" value={fmtDate(asset.warranty_expiry)} />
            <Field label="Added" value={fmtDate(asset.created_at)} />
            <Field
              label="Monitored"
              value={asset.is_monitored ? "Yes" : "No"}
            />
          </div>
          {asset.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Field label="Notes" value={asset.notes} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Current custody
          </h2>
          {asset.custodian ? (
            <div className="mb-4">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {asset.custodian.full_name}
              </div>
              <div className="text-sm text-slate-500">{asset.custodian.email}</div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-500">
              Not assigned — asset is {asset.status.replace(/_/g, " ")}.
            </p>
          )}

          {pendingTransfer ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="text-sm text-slate-700 dark:text-slate-300">
                Pending {pendingTransfer.type}
                {pendingTransfer.to_p
                  ? ` — awaiting acceptance by ${pendingTransfer.to_p.full_name}`
                  : " — awaiting staff confirmation"}
              </div>
              <div className="mt-2">
                <TransferResponseButtons
                  transferId={pendingTransfer.id}
                  assetId={asset.id}
                  canCancel
                />
              </div>
            </div>
          ) : (
            <CustodyPanel
              assetId={asset.id}
              status={asset.status as AssetStatus}
              custodianId={asset.current_custodian}
              employees={employees}
            />
          )}
        </div>
      </div>

      {monitorable && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Device monitoring
          </h2>
          <EnrollPanel assetId={asset.id} enrollment={enrollment} />
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <History className="h-4 w-4" />
          Custody history
        </h2>
        {custodyRows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No custody records yet. The full chain of custody will appear here
            once the asset is issued.
          </p>
        ) : (
          <ol className="space-y-3">
            {custodyRows.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-indigo-200 pl-3 text-sm dark:border-indigo-900"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {c.custodian?.full_name ?? "Unknown"}
                </span>
                <span className="text-slate-500">
                  {fmtDate(c.started_at)} → {c.ended_at ? fmtDate(c.ended_at) : "present"}
                </span>
                {c.end_reason && (
                  <span className="text-xs text-slate-400">({c.end_reason})</span>
                )}
                {c.issuer && (
                  <span className="text-xs text-slate-400">
                    issued by {c.issuer.full_name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
