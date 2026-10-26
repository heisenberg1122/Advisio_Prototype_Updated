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
  Mail,
  Megaphone,
  MessageSquare,
  FileSearch,
  Archive,
} from "lucide-react";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useAuth } from "@/providers/auth-provider";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import { formatAdminLink } from "@/lib/dashboard-navigation";

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      { label: "Overview", href: "/admin/dashboard", tabName: "overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "COLLEGE RESEARCH",
    items: [
      { label: "Students", href: "/admin/dashboard?tab=students", tabName: "students", icon: UserRound },
      { label: "Research Groups", href: "/admin/dashboard?tab=research", tabName: "research", icon: BookOpenCheck },
      { label: "Manuscript Reviews", href: "/admin/reviews", icon: FileSearch },
      { label: "Official Copies", href: "/admin/documents?tab=official", icon: Archive },
      { label: "Progress & Risk", href: "/admin/dashboard?tab=progress", tabName: "progress", icon: ChartNoAxesCombined },
      { label: "Advisers", href: "/admin/dashboard?tab=advisers", tabName: "advisers", icon: UsersRound },
      { label: "Defenses", href: "/admin/dashboard?tab=defenses", tabName: "defenses", icon: ClipboardList },
      { label: "Reports", href: "/admin/dashboard?tab=reports", tabName: "reports", icon: FileBarChart },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Announcements", href: "/admin/dashboard?tab=announcements", tabName: "announcements", icon: Megaphone },
      { label: "Messages", href: "/admin/dashboard?tab=messages", tabName: "messages", icon: MessageSquare },
      { label: "Inbox", href: "/admin/inbox", icon: Mail },
    ],
  },
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
  messages: "Messages",
  announcements: "Announcements",
  inbox: "Inbox",
  settings: "Settings",
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { user } = useAuth();
  const { activeWorkspace } = useDashboardWorkspace();

  const roles = user?.roles || [];
  const canViewOfficialCopies =
    roles.some((role) => ["DEAN", "SYSTEM_ADMIN"].includes(role));

  const rawSections: NavSection[] = ADMIN_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.href !== "/admin/documents?tab=official" || canViewOfficialCopies,
        ),
      }));

  const navSections: NavSection[] = rawSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      href: formatAdminLink(item.href, activeWorkspace?.id),
    })),
  }));

  const activeTab = useSearchParams().get("tab") || "overview";
  const pathname = usePathname() || "";
  const pageTitle =
    pathname === "/admin/profile"
      ? "My Profile"
      : pathname === "/admin/profile/edit"
        ? "Edit Profile"
        : pathname === "/admin/settings"
          ? "Account Settings"
        : pathname === "/admin/notifications"
          ? "Notifications"
        : pathname === "/admin/inbox"
          ? "Inbox"
        : pathname === "/admin/calendar"
          ? "Universal Calendar"
        : pathname === "/admin/reviews"
          ? "Manuscript Reviews"
        : pathname === "/admin/documents"
          ? "Official Copies"
          : PAGE_TITLES[activeTab] || "Dean Dashboard";

  const currentWorkspaceId = activeWorkspace?.id || "dean";
  const dashboardPath = formatAdminLink("/admin/dashboard", currentWorkspaceId);
  const settingsHref = formatAdminLink("/admin/settings", currentWorkspaceId);
  const profileHref = formatAdminLink("/admin/profile", currentWorkspaceId);
  const notificationsHref = formatAdminLink("/admin/notifications", currentWorkspaceId);

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath={dashboardPath}
      padSecondaryPages
      sidebar={
        <AppSidebar
          roleTitle="Dean's Office"
          roleBadge="DEAN PORTAL"
          navSections={navSections}
          collapsed={collapsed}
          onToggleCollapse={toggle}
          settingsHref={settingsHref}
          profileHref={profileHref}
          variant="workspace"
        />
      }
      topbar={
        <AppTopbar
          title={pageTitle}
          hideTitle={pathname === "/admin/dashboard" && activeTab === "overview"}
          subtitle="Research Management Center"
          notificationsHref={notificationsHref}
          profileHref={profileHref}
          settingsHref={settingsHref}
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
    <Suspense fallback={<div className="min-h-screen bg-[var(--sidebar-background)]" />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
