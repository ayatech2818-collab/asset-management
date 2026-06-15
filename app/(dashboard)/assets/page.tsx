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

type Params = { q?: string; status?: string; category?: string };

// Build a filtered URL that preserves the other active filters.
function chipHref(base: Params, patch: Partial<Params>): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.status) sp.set("status", merged.status);
  if (merged.category) sp.set("category", merged.category);
  const qs = sp.toString();
  return qs ? `/assets?${qs}` : "/assets";
}

// Invert-on-select pill chip.
function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </Link>
  );
}

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
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

      <div className="mt-6 space-y-4">
        {/* Pill search — submitting keeps the active chips via hidden fields. */}
        <form method="get" className="relative max-w-md">
          {params.status && (
            <input type="hidden" name="status" value={params.status} />
          )}
          {params.category && (
            <input type="hidden" name="category" value={params.category} />
          )}
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search tag, name, serial…"
            className="w-full rounded-full border border-slate-200 bg-slate-100 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </form>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([v, l]) => (
            <Chip
              key={v || "all-status"}
              href={chipHref(params, { status: v })}
              active={(params.status ?? "") === v}
            >
              {l}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map(([v, l]) => (
            <Chip
              key={v || "all-category"}
              href={chipHref(params, { category: v })}
              active={(params.category ?? "") === v}
            >
              {l}
            </Chip>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          No assets found.{" "}
          <Link href="/assets/new" className="text-indigo-600 hover:underline">
            Add the first one
          </Link>
          .
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="mt-4 space-y-3 md:hidden">
            {assets.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/assets/${a.id}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {a.name}
                  </Link>
                  <StatusBadge status={a.status as AssetStatus} />
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {a.asset_tag}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-slate-400">Category</dt>
                    <dd className="capitalize text-slate-700 dark:text-slate-300">
                      {a.category}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Custodian</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {a.custodian?.full_name ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Location</dt>
                    <dd className="text-slate-700 dark:text-slate-300">
                      {a.location ?? "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
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
                {assets.map((a) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
