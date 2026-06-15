"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { Asset } from "@/lib/types";
import type { ActionState } from "@/lib/actions/assets";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const label =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

const CATEGORIES = [
  ["laptop", "Laptop"],
  ["mobile", "Mobile"],
  ["monitor", "Monitor"],
  ["vehicle", "Vehicle"],
  ["furniture", "Furniture"],
  ["tool", "Tool"],
  ["other", "Other"],
] as const;

const CONDITIONS = [
  ["new", "New"],
  ["good", "Good"],
  ["fair", "Fair"],
  ["damaged", "Damaged"],
] as const;

const MANUAL_STATUSES = [
  ["in_stock", "In stock"],
  ["under_repair", "Under repair"],
  ["retired", "Retired"],
  ["lost", "Lost"],
] as const;

export function AssetForm({
  action,
  asset,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  asset?: Asset | null;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    undefined,
  );

  const custodyControlled =
    asset != null &&
    ["assigned", "pending_acceptance"].includes(asset.status);

  return (
    <form
      action={formAction}
      className="max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="asset_tag" className={label}>
            Asset tag *
          </label>
          <input
            id="asset_tag"
            name="asset_tag"
            required
            maxLength={50}
            defaultValue={asset?.asset_tag ?? ""}
            placeholder="AYT-LT-001"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="name" className={label}>
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={120}
            defaultValue={asset?.name ?? ""}
            placeholder="Dell Latitude 5440"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="category" className={label}>
            Category *
          </label>
          <select
            id="category"
            name="category"
            defaultValue={asset?.category ?? "laptop"}
            className={input}
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="condition" className={label}>
            Condition
          </label>
          <select
            id="condition"
            name="condition"
            defaultValue={asset?.condition ?? "good"}
            className={input}
          >
            {CONDITIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {asset && (
          <div>
            <label htmlFor="status" className={label}>
              Status
            </label>
            {custodyControlled ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                Managed by custody workflow ({asset.status})
              </div>
            ) : (
              <select
                id="status"
                name="status"
                defaultValue={asset.status}
                className={input}
              >
                {MANUAL_STATUSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label htmlFor="brand" className={label}>
            Brand
          </label>
          <input
            id="brand"
            name="brand"
            defaultValue={asset?.brand ?? ""}
            placeholder="Dell"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="model" className={label}>
            Model
          </label>
          <input
            id="model"
            name="model"
            defaultValue={asset?.model ?? ""}
            placeholder="Latitude 5440"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="serial_number" className={label}>
            Serial number
          </label>
          <input
            id="serial_number"
            name="serial_number"
            defaultValue={asset?.serial_number ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="location" className={label}>
            Location
          </label>
          <input
            id="location"
            name="location"
            defaultValue={asset?.location ?? ""}
            placeholder="Office HQ"
            className={input}
          />
        </div>
        <div>
          <label htmlFor="vendor" className={label}>
            Vendor
          </label>
          <input
            id="vendor"
            name="vendor"
            defaultValue={asset?.vendor ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="purchase_price" className={label}>
            Purchase price
          </label>
          <input
            id="purchase_price"
            name="purchase_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={asset?.purchase_price ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="purchase_date" className={label}>
            Purchase date
          </label>
          <input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={asset?.purchase_date ?? ""}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="warranty_expiry" className={label}>
            Warranty expiry
          </label>
          <input
            id="warranty_expiry"
            name="warranty_expiry"
            type="date"
            defaultValue={asset?.warranty_expiry ?? ""}
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={label}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={asset?.notes ?? ""}
          className={input}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
