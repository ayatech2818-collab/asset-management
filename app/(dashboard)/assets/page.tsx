import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/assets/StatusBadge";
import type { Asset, AssetStatus } from "@/lib/types";

type AssetRow = Asset & { custodian: { full_name: string } | null };

const STATUS_FILTERS: [string, string][] = [
  ["", "All statuses"],
  ["in_stock", "In stock"],
  ["assigned", "Assigned"],
  ["pending_acceptance", "Pending acceptance"],
  ["under_repair", "Under repair"],
  ["retired", "Retired"],
  ["lost", "Lost"],
];

const CATEGORY_FILTERS: [string, string][] = [
  ["", "All categories"],
  ["laptop", "Laptop"],
  ["mobile", "Mobile"],
  ["monitor", "Monitor"],
  ["vehicle", "Vehicle"],
  ["furniture", "Furniture"],
  ["tool", "Tool"],
  ["other", "Other"],
];

async function getAssets(filters: {
  q?: string;
  status?: string;
  category?: string;
}): Promise<AssetRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select("*, custodian:current_custodian(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.q) {
    // strip characters that would break the PostgREST or() filter syntax
    const q = filters.q.replace(/[,()]/g, " ").trim();
    if (q) {
      query = query.or(
        `asset_tag.ilike.%${q}%,name.ilike.%${q}%,serial_number.ilike.%${q}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as AssetRow[];
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const assets = await getAssets(params);

  const select =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Assets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {assets.length} asset{assets.length === 1 ? "" : "s"}
            {params.q || params.status || params.category ? " (filtered)" : ""}
          </p>
        </div>
        <Link
          href="/assets/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New asset
        </Link>
      </div>

      <form
        method="get"
        className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search tag, name, serial…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <select name="status" defaultValue={params.status ?? ""} className={select}>
          {STATUS_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className={select}
        >
          {CATEGORY_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Tag</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Custodian</th>
              <th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No assets found.{" "}
                  <Link href="/assets/new" className="text-indigo-600 hover:underline">
                    Add the first one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              assets.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/assets/${a.id}`}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {a.asset_tag}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {a.name}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                    {a.category}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status as AssetStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {a.custodian?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {a.location ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
