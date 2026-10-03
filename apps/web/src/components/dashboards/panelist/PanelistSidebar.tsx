"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  ClipboardCheck,
  Award,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/panelist/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "Defense Schedule", href: "/panelist/dashboard?tab=schedule", tabName: "schedule", icon: CalendarCheck },
  { label: "Documents", href: "/panelist/dashboard?tab=documents", tabName: "documents", icon: FileText },
  { label: "Evaluations", href: "/panelist/dashboard?tab=evaluation", tabName: "evaluation", icon: ClipboardCheck },
  { label: "Results", href: "/panelist/dashboard?tab=grades", tabName: "grades", icon: Award },
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
      settingsHref="/panelist/dashboard?tab=settings"
      profileHref="/panelist/profile"
      variant="workspace"
    />
  );
}
