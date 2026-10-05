"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Inbox,
  Presentation,
  Sliders,
  LineChart,
  CalendarClock,
  CalendarDays,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/professor/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "Announcements", href: "/professor/dashboard?tab=announcements", tabName: "announcements", icon: Megaphone },
  { label: "Researchers & Projects", href: "/professor/dashboard?tab=monitoring", tabName: "monitoring", icon: Users },
  { label: "Submissions", href: "/professor/dashboard?tab=submissions", tabName: "submissions", icon: Inbox },
  { label: "Defense", href: "/professor/dashboard?tab=defense", tabName: "defense", icon: Presentation },
  { label: "Workflow", href: "/professor/dashboard?tab=builder", tabName: "builder", icon: Sliders },
  { label: "Progress", href: "/professor/dashboard?tab=tracking", tabName: "tracking", icon: LineChart },
  { label: "Deadlines", href: "/professor/dashboard?tab=deadlines", tabName: "deadlines", icon: CalendarClock },
  { label: "Calendar", href: "/professor/calendar", icon: CalendarDays },
];

export function ProfessorSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Course Professor"
      roleBadge="COORDINATOR PORTAL"
      navItems={NAV_ITEMS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/professor/dashboard?tab=settings"
      profileHref="/professor/profile"
      variant="workspace"
    />
  );
}
