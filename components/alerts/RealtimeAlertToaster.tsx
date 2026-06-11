"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Toast = { id: string; message: string; severity: string };

const SEVERITY_BORDER: Record<string, string> = {
  high: "border-red-300 dark:border-red-800",
  med: "border-amber-300 dark:border-amber-800",
  low: "border-slate-300 dark:border-slate-700",
};

// Subscribes to new alerts via Supabase Realtime and shows toast
// notifications anywhere in the dashboard. RLS scopes what each user receives.
export function RealtimeAlertToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();

    const channel = supabase
      .channel("alerts-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const a = payload.new as Toast & { severity: string };
          setToasts((prev) => [
            ...prev,
            { id: a.id, message: a.message, severity: a.severity },
          ]);
          // refresh server components so badges/counts update live
          router.refresh();
          setTimeout(
            () => setToasts((prev) => prev.filter((t) => t.id !== a.id)),
            8000,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 rounded-xl border bg-white p-3 shadow-lg dark:bg-slate-900 ${SEVERITY_BORDER[t.severity] ?? SEVERITY_BORDER.low}`}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <Link
              href="/alerts"
              className="block text-sm text-slate-800 hover:underline dark:text-slate-200"
            >
              {t.message}
            </Link>
          </div>
          <button
            type="button"
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            className="rounded p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
