"use client";

import React, { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "Students", href: "/admin/dashboard?tab=students", tabName: "students", icon: UserRound },
  { label: "Research Groups", href: "/admin/dashboard?tab=research", tabName: "research", icon: BookOpenCheck },
  { label: "Progress & Risk", href: "/admin/dashboard?tab=progress", tabName: "progress", icon: ChartNoAxesCombined },
  { label: "Advisers", href: "/admin/dashboard?tab=advisers", tabName: "advisers", icon: UsersRound },
  { label: "Defenses", href: "/admin/dashboard?tab=defenses", tabName: "defenses", icon: ClipboardList },
  { label: "Calendar", href: "/admin/dashboard?tab=calendar", tabName: "calendar", icon: CalendarDays },
  { label: "Reports", href: "/admin/dashboard?tab=reports", tabName: "reports", icon: FileBarChart },
];

const PAGE_TITLES: Record<string, string> = {
  overview: "Dean Dashboard",
  students: "Student Registry",
  research: "Research Monitoring",
  progress: "Progress & Risk",
  advisers: "Adviser Workload",
  defenses: "Defense Management",
  calendar: "Academic Calendar",
  reports: "Research Reports",
  settings: "Settings",
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const activeTab = useSearchParams().get("tab") || "overview";
  const pathname = usePathname() || "";
  const pageTitle =
    pathname === "/admin/profile"
      ? "My Profile"
      : pathname === "/admin/profile/edit"
        ? "Edit Profile"
        : pathname === "/admin/notifications"
          ? "Notifications"
          : PAGE_TITLES[activeTab] || "Dean Dashboard";

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath="/admin/dashboard"
      padSecondaryPages
      sidebar={
        <AppSidebar
          roleTitle="Dean’s Office"
          roleBadge="DEAN PORTAL"
          navItems={NAV_ITEMS}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          settingsHref="/admin/dashboard?tab=settings"
          profileHref="/admin/profile"
          variant="workspace"
        />
      }
      topbar={
        <AppTopbar
          title={pageTitle}
          subtitle="Research Management Center"
          notificationsHref="/admin/notifications"
          profileHref="/admin/profile"
          searchPlaceholder="Search research groups, faculty, defenses..."
          variant="workspace"
        />
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F6F8] dark:bg-[#080E18]" />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
