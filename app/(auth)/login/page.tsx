"use client";

import { useActionState } from "react";
import {
  Boxes,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  MapPin,
  Bell,
} from "lucide-react";
import { login, type AuthState } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const FEATURES = [
  { icon: ShieldCheck, text: "Chain-of-custody ledger for every asset" },
  { icon: MapPin, text: "Live location, battery & security posture" },
  { icon: Bell, text: "Instant alerts for low battery, offline & mismatches" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    undefined,
  );

  const field =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row dark:bg-slate-950">
      {/* Hero / marketing panel */}
      <div className="flex flex-1 flex-col justify-center gap-7 px-6 py-12 sm:px-10 lg:px-16">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Boxes className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AssetHub
          </span>
        </div>

        <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
          Every asset
          <br />
          accounted for.
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-slate-500">
          Custody handovers, device monitoring, and alerts — one calm dashboard
          for your whole fleet.
        </p>

        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to manage your assets.
            </p>

            {!isSupabaseConfigured && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Supabase isn&apos;t configured yet. Add your keys to{" "}
                  <code className="font-mono">.env.local</code> and restart the
                  dev server to enable login.
                </span>
              </div>
            )}

            <form action={formAction} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={field}
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={field}
                  placeholder="••••••••"
                />
              </div>

              {state?.error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
