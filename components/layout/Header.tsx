"use client";

import { Menu, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

const ROLE_LABEL: Record<Profile["role"], string> = {
  admin: "Admin",
  asset_manager: "Asset Manager",
  employee: "Employee",
};

export function Header({
  profile,
  onMenu,
}: {
  profile: Profile;
  onMenu: () => void;
}) {
  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Mobile-only: menu button + brand. Desktop shows the sidebar instead. */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="-ml-1 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <BrandLogo />
      </div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {initials || "?"}
          </div>
          <div className="hidden leading-tight sm:block">
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
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
