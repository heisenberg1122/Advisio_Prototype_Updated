"use client";

import { useMemo } from "react";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Clock,
  FileText,
  FolderOpen,
  CalendarClock,
  CalendarDays,
  MessageSquare,
  Mail,
  Presentation,
} from "lucide-react";

const STUDENT_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      {
        label: "Overview",
        href: "/student/dashboard",
        tabName: "overview",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "RESEARCH WORKSPACE",
    items: [
      {
        label: "My Project",
        href: "/student/dashboard?tab=group",
        tabName: "group",
        icon: FolderKanban,
      },
      { label: "Tasks", href: "/student/tasks", icon: CheckSquare },
      { label: "Documents", href: "/student/documents", icon: FileText },
      { label: "Group Files", href: "/student/group-files", icon: FolderOpen },
      {
        label: "Timeline",
        href: "/student/dashboard?tab=milestones",
        tabName: "milestones",
        icon: Clock,
      },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Defense", href: "/student/defense", icon: Presentation },
      {
        label: "Consultations",
        href: "/student/dashboard?tab=consultations",
        tabName: "consultations",
        icon: CalendarClock,
      },
      { label: "Calendar", href: "/student/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      {
        label: "Messages",
        href: "/student/dashboard?tab=group-chats",
        tabName: "group-chats",
        icon: MessageSquare,
      },
      { label: "Inbox", href: "/student/inbox", icon: Mail },
    ],
  },
];

export function StudentSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { activeProjectId, projectHref, authorizedProjectIds } =
    useActiveProjectContext();
  const hasResearchCase = Boolean(authorizedProjectIds?.length);
  const navSections = useMemo(
    () =>
      STUDENT_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .filter(
            (item) =>
              hasResearchCase ||
              item.href === "/student/dashboard" ||
              item.tabName === "group" ||
              item.href === "/student/inbox" ||
              item.href === "/student/calendar",
          )
          .map((item) => ({
            ...item,
            label:
              item.tabName === "group"
                ? hasResearchCase
                  ? "My Research"
                  : "Research Cohort & Team"
                : item.label,
            href: projectHref(item.href, activeProjectId),
          })),
      })).filter((section) => section.items.length > 0),
    [activeProjectId, projectHref, hasResearchCase],
  );

  return (
    <AppSidebar
      roleTitle="Student Researcher"
      roleBadge="RESEARCHER PANEL"
      navSections={navSections}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/student/settings"
      profileHref="/student/profile"
      variant="workspace"
    />
  );
}
