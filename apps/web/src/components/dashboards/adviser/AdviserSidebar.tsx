"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { UserChip } from "@/components/shared/UserChip";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/hooks/use-profile";

const MENU_SECTIONS = [
  {
    title: "HOME",
    items: [
      { label: "Dashboard", href: "/adviser/dashboard", tabName: "overview", icon: "ti-layout-dashboard" },
    ],
  },
  {
    title: "MY ADVISEES",
    items: [
      { label: "Assigned Advisees", href: "/adviser/dashboard?tab=advisees", tabName: "advisees", icon: "ti-users" },
      { label: "Milestone Approval & Recommendation", href: "/adviser/dashboard?tab=approvals", tabName: "approvals", icon: "ti-circle-check" },
      { label: "Research Group Progress", href: "/adviser/dashboard?tab=progress", tabName: "progress", icon: "ti-chart-line" },
    ],
  },
  {
    title: "DOCUMENTS",
    items: [
      { label: "Document Review & Commenting", href: "/adviser/dashboard?tab=reviews", tabName: "reviews", icon: "ti-file-text" },
    ],
  },
  {
    title: "CONSULTATIONS",
    items: [
      { label: "Consultation Schedule", href: "/adviser/dashboard?tab=consultations", tabName: "consultations", icon: "ti-calendar-event" },
      { label: "Consultation History", href: "/adviser/dashboard?tab=history", tabName: "history", icon: "ti-history" },
      { label: "Group Conferencing", href: "/adviser/dashboard?tab=conferencing", tabName: "conferencing", icon: "ti-video" },
      { label: "Adviser Group Chats", href: "/adviser/dashboard?tab=group-chats", tabName: "group-chats", icon: "ti-messages" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "Settings", href: "/adviser/dashboard?tab=settings", tabName: "settings", icon: "ti-settings" },
    ],
  },
];

function normalizePath(p: string) {
  return p.split("?")[0].replace(/\/$/, "");
}

function isActiveRoute(item: { href: string; tabName: string }, pathname: string, currentTab: string) {
  const cleanHref = normalizePath(item.href);
  const cleanPathname = normalizePath(pathname);
  const isDashboardLink = cleanHref.endsWith("/dashboard") && !item.href.includes("?tab=");
  const isTabItem = item.href.includes("?tab=");

  if (isDashboardLink) {
    return cleanPathname === cleanHref && (currentTab === "overview" || currentTab === "");
  }
  if (isTabItem) {
    return cleanPathname === cleanHref && currentTab === item.tabName;
  }
  return cleanPathname === cleanHref;
}

export function AdviserSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "";
  const currentTab = searchParams.get("tab") || "overview";
  const { collapsed, toggle } = useSidebarCollapsed();
  const { profile } = useProfile();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className={`relative bg-[#1b4264] border-r border-[#ffa400]/10 flex flex-col justify-between select-none h-full transition-all duration-300 ease-in-out text-slate-350 ${
        collapsed ? "w-[64px]" : "w-[240px]"
      }`}
    >
      {/* Edge collapse toggle button */}
      <button
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-50 w-6 h-6 rounded-full bg-[#ffa400] text-[#1b4264] shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-[#1b4264] cursor-pointer"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <i className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-left"} text-xs font-bold`} />
      </button>

      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Logo block */}
        <div className={`px-3 py-4 border-b border-white/10 shrink-0 flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-school text-base text-[#ffa400]" />
              </div>
              <div>
                <span className="font-extrabold text-[15px] tracking-tight block leading-none text-white font-sans">ADVISIO</span>
                <span className="text-[8px] uppercase tracking-wider text-[#ffa400] font-semibold mt-0.5 block">Adviser Panel</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <i className="ti ti-school text-base text-[#ffa400]" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-2 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-3 pt-2 pb-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-400/70 select-none">
                  {section.title}
                </span>
              )}
              {collapsed && <div className="pt-2" />}
              {section.items.map((item) => {
                const isActive = isActiveRoute(item, pathname, currentTab);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-lg text-[12px] transition-all ${
                      collapsed ? "px-0 py-2 justify-center" : "px-3 py-2"
                    } ${
                      isActive
                        ? "bg-[#ffa400] text-[#1b4264] font-bold shadow-md shadow-[#ffa400]/10"
                        : "hover:bg-white/5 hover:text-white text-slate-300"
                    }`}
                  >
                    <i className={`ti ${item.icon} text-base flex-shrink-0`} />
                    {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom: user + logout — PERMANENTLY PINNED, NEVER SCROLLED */}
      <div className={`shrink-0 p-3 border-t border-white/10 bg-[#1b4264] flex flex-col gap-2 z-10 ${collapsed ? "items-center" : ""}`}>
        <UserChip profile={profile as any} collapsed={collapsed} />
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`flex items-center gap-2.5 rounded-lg text-[12px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all font-semibold cursor-pointer ${
            collapsed ? "px-0 py-2 justify-center w-full" : "px-3 py-2 w-full"
          }`}
        >
          <i className="ti ti-logout text-base flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
