"use client";

import React, { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Wrench,
  FileText,
  Database,
  Users,
  Building2,
  Shield,
  CloudCog,
  CalendarDays,
  Mail,
} from "lucide-react";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

const SYSTEM_ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      {
        label: "Overview",
        href: "/system-admin/dashboard",
        tabName: "overview",
        icon: LayoutDashboard,
      },
      {
        label: "Announcements",
        href: "/system-admin/dashboard?tab=announcements",
        tabName: "announcements",
        icon: Megaphone,
      },
    ],
  },
  {
    title: "SYSTEM ADMINISTRATION",
    items: [
      {
        label: "Users",
        href: "/system-admin/dashboard?tab=users",
        tabName: "users",
        icon: Users,
      },
      {
        label: "College & Programs",
        href: "/system-admin/dashboard?tab=onboarding",
        tabName: "onboarding",
        icon: Building2,
      },
      {
        label: "Role Permissions",
        href: "/system-admin/dashboard?tab=roles",
        tabName: "roles",
        icon: Shield,
      },
      {
        label: "System Configuration",
        href: "/system-admin/dashboard?tab=config",
        tabName: "config",
        icon: Wrench,
      },
      {
        label: "Integrations",
        href: "/system-admin/dashboard?tab=integrations",
        tabName: "integrations",
        icon: CloudCog,
      },
      {
        label: "Audit Logs",
        href: "/system-admin/dashboard?tab=logs",
        tabName: "logs",
        icon: FileText,
      },
      {
        label: "Database Backups",
        href: "/system-admin/dashboard?tab=backups",
        tabName: "backups",
        icon: Database,
      },
    ],
  },
  {
    title: "COMMUNICATION & SCHEDULE",
    items: [
      {
        label: "Calendar",
        href: "/system-admin/calendar",
        icon: CalendarDays,
      },
      {
        label: "Inbox",
        href: "/system-admin/inbox",
        icon: Mail,
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  overview: "System Admin Dashboard",
  announcements: "System Announcements",
  users: "User Management",
  onboarding: "College & Department Onboarding",
  roles: "Global Role Permission Matrix",
  config: "System Parameter Configuration",
  integrations: "Platform Integrations",
  logs: "System Audit Logs",
  backups: "Backup & Restore Management",
  settings: "Portal Settings",
};

function SystemAdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const activeTab = useSearchParams().get("tab") || "overview";
  const pathname = usePathname() || "";
  const pageTitle =
    pathname === "/system-admin/profile"
      ? "My Profile"
      : pathname === "/system-admin/profile/edit"
        ? "Edit Profile"
        : pathname === "/system-admin/notifications"
          ? "Notifications"
          : pathname === "/system-admin/calendar"
            ? "Universal Calendar"
          : pathname === "/system-admin/inbox"
            ? "Inbox"
            : PAGE_TITLES[activeTab] || "System Administration";

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath="/system-admin/dashboard"
      padSecondaryPages
      sidebar={
        <AppSidebar
          roleTitle="System Administrator"
          roleBadge="ADMIN CONSOLE"
          navSections={SYSTEM_ADMIN_NAV_SECTIONS}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          settingsHref="/system-admin/dashboard?tab=settings"
          profileHref="/system-admin/profile"
          variant="workspace"
        />
      }
      topbar={
        <AppTopbar
          title={pageTitle}
          hideTitle={pathname === "/system-admin/dashboard" && activeTab === "overview"}
          subtitle="Platform Control Center"
          notificationsHref="/system-admin/notifications"
          profileHref="/system-admin/profile"
          settingsHref="/system-admin/dashboard?tab=settings"
          searchPlaceholder="Search audit logs, users, system settings..."
          variant="workspace"
        />
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[var(--sidebar-background)]" />}
    >
      <SystemAdminLayoutInner>{children}</SystemAdminLayoutInner>
    </Suspense>
  );
}
