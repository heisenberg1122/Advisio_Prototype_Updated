"use client";

import { useMemo } from "react";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
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
      { label: "Overview", href: "/student/dashboard", tabName: "overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "RESEARCH WORKSPACE",
    items: [
      { label: "My Project", href: "/student/dashboard?tab=group", tabName: "group", icon: FolderKanban },
      { label: "My Group", href: "/student/dashboard?tab=my-group", tabName: "my-group", icon: Users },
      { label: "Tasks", href: "/student/tasks", icon: CheckSquare },
      { label: "Documents", href: "/student/documents", icon: FileText },
      { label: "Group Files", href: "/student/group-files", icon: FolderOpen },
      { label: "Timeline", href: "/student/dashboard?tab=milestones", tabName: "milestones", icon: Clock },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Defense", href: "/student/defense", icon: Presentation },
      { label: "Consultations", href: "/student/dashboard?tab=consultations", tabName: "consultations", icon: CalendarClock },
      { label: "Calendar", href: "/student/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Messages", href: "/student/dashboard?tab=group-chats", tabName: "group-chats", icon: MessageSquare },
      { label: "Inbox", href: "/student/inbox", icon: Mail },
    ],
  },
];

export function StudentSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { activeProjectId, projectHref } = useActiveProjectContext();
  const navSections = useMemo(
    () =>
      STUDENT_NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          href: projectHref(item.href, activeProjectId),
        })),
      })),
    [activeProjectId, projectHref],
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
