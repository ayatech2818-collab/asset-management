"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  MapPin,
  Bell,
  UserCircle,
  Users,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { isStaff, isAdmin } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (role: Role) => boolean;
};

const ALL = () => true;
const STAFF = (r: Role) => isStaff(r);
const ADMIN = (r: Role) => isAdmin(r);

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: ALL },
  { href: "/assets", label: "Assets", icon: Boxes, show: STAFF },
  { href: "/my-assets", label: "My Assets", icon: UserCircle, show: ALL },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight, show: ALL },
  { href: "/monitoring", label: "Monitoring", icon: MapPin, show: STAFF },
  { href: "/alerts", label: "Alerts", icon: Bell, show: ALL },
  { href: "/employees", label: "Employees", icon: Users, show: ADMIN },
  { href: "/reports", label: "Reports", icon: FileBarChart, show: STAFF },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => item.show(role));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Boxes className="h-5 w-5" />
        </div>
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          AssetHub
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
