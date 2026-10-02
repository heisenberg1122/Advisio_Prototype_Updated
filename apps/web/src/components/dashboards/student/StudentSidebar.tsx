"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/hooks/use-profile";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { label: "Overview", href: "/student/dashboard", tabName: "overview", icon: "ti-home" },
  { label: "My Project", href: "/student/dashboard?tab=group", tabName: "group", icon: "ti-file-text" },
  { label: "Tasks", href: "/student/tasks", tabName: "tasks", icon: "ti-checklist" },
  { label: "Adviser Pool", href: "/student/adviser-pool", tabName: "adviser-pool", icon: "ti-user-search" },
  { label: "Timeline", href: "/student/dashboard?tab=milestones", tabName: "milestones", icon: "ti-timeline-event" },
  { label: "Documents", href: "/student/dashboard?tab=workspace", tabName: "workspace", icon: "ti-folder" },
  { label: "Consultations", href: "/student/dashboard?tab=consultations", tabName: "consultations", icon: "ti-calendar-event" },
  { label: "Messages", href: "/student/dashboard?tab=group-chats", tabName: "group-chats", icon: "ti-message" },
];

const TAB_FAMILIES: Record<string, string[]> = {
  group: ["group", "adviser-credentials", "ai-recommendation", "defense", "certificates"],
  milestones: ["milestones", "progress"],
  workspace: ["workspace", "submission", "submissions", "version-control"],
  consultations: ["consultations", "consultation-requests", "consultation-repo", "conferencing"],
  "group-chats": ["group-chats"],
};

export function StudentSidebar() {
  const pathname = usePathname() || "";
  const currentTab = useSearchParams().get("tab") || "overview";
  const { profile } = useProfile();
  const { logout } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();
  const displayName = profile?.name || "Student01";
  const initials = profile?.initials || "SU";

  return (
    <aside className={`relative flex h-full flex-col bg-[#143d5d] text-white transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}>
      <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#f6a800] text-[#143d5d] shadow-md transition hover:scale-105" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        <i className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-left"} text-xs font-bold`} />
      </button>

      <div className={`flex h-[76px] shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <div className="flex items-center gap-3">
          <i className="ti ti-school text-[30px] text-[#f6a800]" />
          {!collapsed && <div><div className="text-[20px] font-extrabold leading-none tracking-tight">ADVISIO</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300">Researcher Panel</div></div>}
        </div>
      </div>

      <nav className={`flex flex-1 flex-col gap-2 pt-5 ${collapsed ? "px-2" : "px-3"}`} aria-label="Student navigation">
        {NAV_ITEMS.map((item) => {
          const inFamily = TAB_FAMILIES[item.tabName]?.includes(currentTab);
          const active = ["adviser-pool", "tasks"].includes(item.tabName) ? pathname === item.href : pathname === "/student/dashboard" && (item.tabName === "overview" ? currentTab === "overview" : inFamily);
          return (
            <Link key={item.label} href={item.href} title={collapsed ? item.label : undefined} className={`flex h-[52px] items-center rounded-xl transition ${collapsed ? "justify-center px-0" : "gap-4 px-4"} ${active ? "bg-[#f6a800] font-bold text-[#102f49] shadow-sm" : "text-slate-100 hover:bg-white/10"}`}>
              <i className={`ti ${item.icon} text-[22px]`} />
              {!collapsed && <span className="text-[15px]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`shrink-0 border-t border-white/15 p-3 ${collapsed ? "space-y-2" : "space-y-1"}`}>
        <Link href="/student/settings" className={`flex h-11 items-center rounded-xl text-slate-100 transition hover:bg-white/10 ${collapsed ? "justify-center" : "gap-4 px-3"}`}>
          <i className="ti ti-settings text-xl" />{!collapsed && <span className="text-sm">Settings</span>}
        </Link>
        <Link href="/student/profile" className={`flex items-center rounded-xl py-2 transition hover:bg-white/10 ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold">{initials}</span>
          {!collapsed && <><span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName}</span><i className="ti ti-chevron-down text-sm text-slate-300" /></>}
        </Link>
        <button
          onClick={logout}
          title={collapsed ? "Sign Out" : undefined}
          className={`flex h-11 w-full items-center rounded-xl text-red-300 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer ${collapsed ? "justify-center" : "gap-4 px-3"}`}
        >
          <i className="ti ti-logout text-xl" />
          {!collapsed && <span className="text-sm font-semibold">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
