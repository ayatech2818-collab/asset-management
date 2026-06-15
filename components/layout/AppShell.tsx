"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileDrawer } from "./MobileDrawer";
import { BottomNav } from "./BottomNav";

// Responsive dashboard chrome. Owns the mobile drawer state. The desktop
// sidebar is always visible from `lg` up; below that, a top-bar hamburger opens
// the drawer and a bottom tab bar provides quick navigation.
export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-full">
      <Sidebar role={profile.role} className="hidden lg:flex" />
      <MobileDrawer
        role={profile.role}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header profile={profile} onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-24 lg:p-6 lg:pb-6 dark:bg-slate-950">
          {children}
        </main>
      </div>

      <BottomNav role={profile.role} />
    </div>
  );
}
