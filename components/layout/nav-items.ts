import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  MapPin,
  Bell,
  UserCircle,
  Users,
  FileBarChart,
  Settings,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { isStaff, isAdmin } from "@/lib/types";

// Single source of truth for navigation, shared by the desktop sidebar, the
// mobile slide-out drawer, and the mobile bottom tab bar.
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  show: (role: Role) => boolean;
  // Surfaced in the mobile bottom bar (the most-used sections).
  bottomBar?: boolean;
};

const ALL = () => true;
const STAFF = (r: Role) => isStaff(r);
const ADMIN = (r: Role) => isAdmin(r);

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: ALL, bottomBar: true },
  { href: "/assets", label: "Assets", icon: Boxes, show: STAFF },
  { href: "/my-assets", label: "My Assets", icon: UserCircle, show: ALL, bottomBar: true },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight, show: ALL },
  { href: "/monitoring", label: "Monitoring", icon: MapPin, show: STAFF, bottomBar: true },
  { href: "/alerts", label: "Alerts", icon: Bell, show: ALL, bottomBar: true },
  { href: "/download", label: "Get the app", icon: Smartphone, show: ALL },
  { href: "/employees", label: "Employees", icon: Users, show: ADMIN },
  { href: "/reports", label: "Reports", icon: FileBarChart, show: STAFF },
  { href: "/settings", label: "Settings", icon: Settings, show: ADMIN },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => i.show(role));
}

// The bottom bar fits a handful of items comfortably — cap at 5.
export function bottomNavFor(role: Role): NavItem[] {
  return NAV.filter((i) => i.show(role) && i.bottomBar).slice(0, 5);
}
