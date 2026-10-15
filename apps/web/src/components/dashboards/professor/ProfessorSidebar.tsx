"use client";

import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Inbox,
  FileSearch,
  Presentation,
  Sliders,
  LineChart,
  CalendarDays,
  Mail,
  MessageSquare,
  Archive,
} from "lucide-react";

const PROFESSOR_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      { label: "Overview", href: "/professor/dashboard", tabName: "overview", icon: LayoutDashboard },
      { label: "Announcements", href: "/professor/dashboard?tab=announcements", tabName: "announcements", icon: Megaphone },
    ],
  },
  {
    title: "COURSE WORKSPACE",
    items: [
      { label: "Research Projects", href: "/professor/dashboard?tab=monitoring", tabName: "monitoring", icon: Users },
      { label: "Submissions", href: "/professor/dashboard?tab=submissions", tabName: "submissions", icon: Inbox },
      { label: "Manuscript Reviews", href: "/professor/reviews", icon: FileSearch },
      { label: "Official Copies", href: "/professor/documents?tab=official", icon: Archive },
      { label: "Workflow", href: "/professor/dashboard?tab=builder", tabName: "builder", icon: Sliders },
      { label: "Progress", href: "/professor/dashboard?tab=tracking", tabName: "tracking", icon: LineChart },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Defense", href: "/professor/dashboard?tab=defense", tabName: "defense", icon: Presentation },
      { label: "Calendar", href: "/professor/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Messages", href: "/professor/dashboard?tab=messages", tabName: "messages", icon: MessageSquare },
      { label: "Inbox", href: "/professor/inbox", icon: Mail },
    ],
  },
];

export function ProfessorSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Course Professor"
      roleBadge="COORDINATOR PORTAL"
      navSections={PROFESSOR_NAV_SECTIONS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/professor/settings"
      profileHref="/professor/profile"
      variant="workspace"
    />
  );
}
