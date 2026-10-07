"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  FileText,
  ClipboardCheck,
  Award,
  Mail,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/panelist/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "Defense Schedule", href: "/panelist/dashboard?tab=schedule", tabName: "schedule", icon: CalendarCheck },
  { label: "Calendar", href: "/panelist/calendar", icon: CalendarDays },
  { label: "Documents", href: "/panelist/dashboard?tab=documents", tabName: "documents", icon: FileText },
  { label: "Evaluations", href: "/panelist/dashboard?tab=evaluation", tabName: "evaluation", icon: ClipboardCheck },
  { label: "Results", href: "/panelist/dashboard?tab=grades", tabName: "grades", icon: Award },
  { label: "Inbox", href: "/panelist/inbox", icon: Mail },
];

export function PanelistSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Defense Panelist"
      roleBadge="PANELIST CENTER"
      navItems={NAV_ITEMS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/panelist/settings"
      profileHref="/panelist/profile"
      variant="workspace"
    />
  );
}
