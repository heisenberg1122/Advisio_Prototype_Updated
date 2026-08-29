"use client";

import React, { Suspense } from "react";
import { Providers } from "@/providers";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { UserChip } from "@/components/shared/UserChip";
import { useNotifications } from "@/hooks/use-notifications";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

const MENU_SECTIONS = [
  {
    title: "HOME",
    items: [
      { label: "Dashboard", href: "/system-admin/dashboard", tabName: "overview", icon: "ti-layout-dashboard" },
    ],
  },
  {
    title: "SYSTEM CONTROL",
    items: [
      { label: "Platform Maintenance & Configuration", href: "/system-admin/dashboard?tab=maintenance", tabName: "maintenance", icon: "ti-tool" },
      { label: "System-Wide Analytics & Reporting", href: "/system-admin/dashboard?tab=analytics", tabName: "analytics", icon: "ti-presentation" },
      { label: "Settings", href: "/system-admin/dashboard?tab=settings", tabName: "settings", icon: "ti-settings" },
    ],
  },
  {
    title: "USER ACCESS",
    items: [
      { label: "College & Department Onboarding", href: "/system-admin/dashboard?tab=onboarding", tabName: "onboarding", icon: "ti-building" },
      { label: "User Role & Access Oversight", href: "/system-admin/dashboard?tab=roles", tabName: "roles", icon: "ti-shield" },
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

function SystemAdminSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "";
  const currentTab = searchParams.get("tab") || "overview";
  const { collapsed, toggle } = useSidebarCollapsed();

  const profile = {
    id: "system-admin-001",
    name: "System Super Admin",
    initials: "SA",
    role: "system_admin",
  };

  const handleLogout = () => {
    router.push("/login");
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

      <div className="flex flex-col min-h-0">
        {/* Logo block */}
        <div className={`px-3 py-4 border-b border-white/10 flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-lock text-base text-[#ffa400]" />
              </div>
              <div>
                <span className="font-extrabold text-[15px] tracking-tight block leading-none text-white">ADVISIO</span>
                <span className="text-[8px] uppercase tracking-wider text-[#ffa400] font-semibold mt-0.5 block">System Admin</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <i className="ti ti-lock text-base text-[#ffa400]" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-2 flex flex-col gap-1 overflow-y-auto flex-1">
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
                    className={`flex items-center gap-3 rounded-lg text-[12.5px] transition-all ${
                      collapsed ? "px-0 py-2 justify-center" : "px-3 py-2.5"
                    } ${
                      isActive
                        ? "bg-[#ffa400] text-[#1b4264] font-bold shadow-md shadow-[#ffa400]/10"
                        : "hover:bg-white/5 hover:text-white text-slate-350"
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

      {/* Bottom: user + logout */}
      <div className={`p-3 border-t border-white/10 flex flex-col gap-2 ${collapsed ? "items-center" : ""}`}>
        <UserChip profile={profile as any} collapsed={collapsed} />
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`flex items-center gap-3 rounded-lg text-[12.5px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all font-semibold cursor-pointer ${
            collapsed ? "px-0 py-2 justify-center w-full" : "px-3 py-2.5 w-full"
          }`}
        >
          <i className="ti ti-logout text-base flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function SystemAdminTopbar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const { unreadCount } = useNotifications();

  const PAGE_TITLES: Record<string, string> = {
    "/system-admin/notifications": "Notifications",
    "/system-admin/profile": "My Profile",
    "/system-admin/profile/edit": "Edit Profile",
  };

  const SYSADMIN_TAB_TITLES: Record<string, string> = {
    overview: "System Admin Dashboard",
    logs: "System Audit Logs",
    backups: "Backup & Restore Management",
    roles: "Global Role Permission Matrix",
    config: "System Parameter Configuration",
    settings: "Settings",
  };

  let title = PAGE_TITLES[pathname] ?? "System Admin Dashboard";
  if (pathname === "/system-admin/dashboard") {
    title = SYSADMIN_TAB_TITLES[currentTab] || "System Admin Dashboard";
  }

  return (
    <header className="h-[52px] flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
      <span className="text-[13px] font-medium text-slate-800">{title}</span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/system-admin/notifications"
          className={cn("icon-btn relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition", unreadCount > 0 && "badge-dot")}
          aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
        >
          <i className="ti ti-bell text-base" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>
        <Link
          href="/system-admin/profile"
          className="w-8 h-8 rounded-full bg-[#1b4264] text-white flex items-center justify-center text-[11px] font-bold hover:opacity-90 transition"
          title="My Profile"
          aria-label="Go to profile"
        >
          SA
        </Link>
      </div>
    </header>
  );
}

function SystemAdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div
      className="flex h-full min-h-screen text-slate-100"
      style={{ display: "grid", gridTemplateColumns: collapsed ? "64px 1fr" : "240px 1fr", transition: "grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1)" }}
    >
      <Suspense fallback={<div className="bg-[#1b4264] w-[240px] h-full" />}>
        <SystemAdminSidebar />
      </Suspense>
      <div className="flex flex-col bg-slate-50 overflow-hidden text-slate-800 min-w-0">
        <Suspense fallback={<header className="h-[52px] bg-white border-b border-slate-200" />}>
          <SystemAdminTopbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <SystemAdminLayoutInner>{children}</SystemAdminLayoutInner>
    </Providers>
  );
}
