import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  employee: "Employee",
};

export function Header({ profile }: { profile: Profile }) {
  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {initials || "?"}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {profile.full_name}
          </div>
          <div className="text-xs text-slate-500">
            {ROLE_LABEL[profile.role]}
          </div>
        </div>
      </div>

      <form action={logout}>
        <button
          type="submit"
          title="Sign out"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </header>
  );
}
