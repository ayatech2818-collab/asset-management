import type { Role } from "@/lib/types";
import { navFor } from "./nav-items";
import { NavList } from "./NavList";
import { BrandLogo } from "./BrandLogo";

// Desktop sidebar. Display (`hidden lg:flex`) is supplied by the caller so the
// same component can be hidden on mobile, where the drawer takes over.
export function Sidebar({
  role,
  className = "",
}: {
  role: Role;
  className?: string;
}) {
  return (
    <aside
      className={`w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex h-16 items-center border-b border-slate-200 px-5 dark:border-slate-800">
        <BrandLogo />
      </div>
      <NavList items={navFor(role)} />
    </aside>
  );
}
