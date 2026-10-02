"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/hooks/use-profile";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/professor/dashboard",
    tab: "overview",
    icon: "ti-home",
  },
  {
    label: "Announcements",
    href: "/professor/dashboard?tab=announcements",
    tab: "announcements",
    icon: "ti-speakerphone",
  },
  {
    label: "Research Groups",
    href: "/professor/dashboard?tab=monitoring",
    tab: "monitoring",
    icon: "ti-users",
  },
  {
    label: "Submissions",
    href: "/professor/dashboard?tab=submissions",
    tab: "submissions",
    icon: "ti-inbox",
  },
  {
    label: "Defense",
    href: "/professor/dashboard?tab=defense",
    tab: "defense",
    icon: "ti-presentation",
  },
  {
    label: "Workflow",
    href: "/professor/dashboard?tab=builder",
    tab: "builder",
    icon: "ti-adjustments",
  },
  {
    label: "Progress",
    href: "/professor/dashboard?tab=tracking",
    tab: "tracking",
    icon: "ti-chart-line",
  },
  {
    label: "Deadlines",
    href: "/professor/dashboard?tab=deadlines",
    tab: "deadlines",
    icon: "ti-calendar-due",
  },
];

const FAMILIES: Record<string, string[]> = {
  monitoring: ["monitoring"],
  announcements: ["announcements"],
  submissions: ["submissions"],
  defense: ["defense"],
  builder: ["builder", "deployment", "locking", "workflow"],
  tracking: ["tracking", "completion"],
  deadlines: ["deadlines"],
};

export function ProfessorSidebar() {
  const pathname = usePathname() || "";
  const currentTab = useSearchParams().get("tab") || "overview";
  const { collapsed, toggle } = useSidebarCollapsed();
  const { profile } = useProfile();
  const { logout } = useAuth();
  return (
    <aside
      className={`relative flex h-full flex-col bg-[#143d5d] text-white transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      <button
        onClick={toggle}
        className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#f6a800] text-[#143d5d] shadow-md"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <i
          className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-left"} text-xs font-bold`}
        />
      </button>
      <div
        className={`flex h-[76px] shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center" : "px-5"}`}
      >
        <div className="flex items-center gap-3">
          <i className="ti ti-school text-[30px] text-[#f6a800]" />
          {!collapsed && (
            <div>
              <div className="text-[20px] font-extrabold leading-none">
                ADVISIO
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                Professor Panel
              </div>
            </div>
          )}
        </div>
      </div>
      <nav
        className={`flex flex-1 flex-col gap-2 pt-5 ${collapsed ? "px-2" : "px-3"}`}
        aria-label="Professor navigation"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === "/professor/dashboard" &&
            (item.tab === "overview"
              ? currentTab === "overview"
              : FAMILIES[item.tab]?.includes(currentTab));
          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex h-[52px] items-center rounded-xl transition ${collapsed ? "justify-center" : "gap-4 px-4"} ${active ? "bg-[#f6a800] font-bold text-[#102f49]" : "text-slate-100 hover:bg-white/10"}`}
            >
              <i className={`ti ${item.icon} text-[22px]`} />
              {!collapsed && <span className="text-[15px]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-white/15 p-3">
        <Link
          href="/professor/dashboard?tab=settings"
          className={`flex h-11 items-center rounded-xl hover:bg-white/10 ${collapsed ? "justify-center" : "gap-4 px-3"}`}
        >
          <i className="ti ti-settings text-xl" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>
        <Link
          href="/professor/profile"
          className={`mt-1 flex items-center rounded-xl py-2 hover:bg-white/10 ${collapsed ? "justify-center" : "gap-3 px-2"}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold">
            {profile?.initials || "CP"}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm">
                {profile?.name || "Course Professor"}
              </span>
              <i className="ti ti-chevron-down text-sm text-slate-300" />
            </>
          )}
        </Link>
        <button
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
          className={`mt-1 flex h-11 w-full items-center rounded-xl text-red-300 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer ${collapsed ? "justify-center" : "gap-4 px-3"}`}
        >
          <i className="ti ti-logout text-xl" />
          {!collapsed && (
            <span className="text-sm font-semibold">Sign Out</span>
          )}
        </button>
      </div>
    </aside>
  );
}
