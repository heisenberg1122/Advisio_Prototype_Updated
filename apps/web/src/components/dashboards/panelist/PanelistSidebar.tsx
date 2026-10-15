"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  FileText,
  ClipboardCheck,
  Award,
  Mail,
  MessageSquare,
  Archive,
} from "lucide-react";

const PANELIST_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      { label: "Overview", href: "/panelist/dashboard", tabName: "overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "PANEL EVALUATIONS",
    items: [
      { label: "Manuscript Reviews", href: "/panelist/reviews", icon: FileText },
      { label: "Official Copies", href: "/panelist/documents?tab=official", icon: Archive },
      { label: "Evaluations", href: "/panelist/dashboard?tab=evaluation", tabName: "evaluation", icon: ClipboardCheck },
      { label: "Results", href: "/panelist/dashboard?tab=grades", tabName: "grades", icon: Award },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Defense Schedule", href: "/panelist/dashboard?tab=schedule", tabName: "schedule", icon: CalendarCheck },
      { label: "Calendar", href: "/panelist/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Messages", href: "/panelist/dashboard?tab=messages", tabName: "messages", icon: MessageSquare },
      { label: "Inbox", href: "/panelist/inbox", icon: Mail },
    ],
  },
];

export function PanelistSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Defense Panelist"
      roleBadge="PANELIST CENTER"
      navSections={PANELIST_NAV_SECTIONS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/panelist/settings"
      profileHref="/panelist/profile"
      variant="workspace"
    />
  );
}
