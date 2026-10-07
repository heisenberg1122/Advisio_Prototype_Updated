"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  Users,
  FileSearch,
  Calendar,
  MessageSquare,
  Mail,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/adviser/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "My Advisees", href: "/adviser/dashboard?tab=advisees", tabName: "advisees", icon: Users },
  { label: "Reviews", href: "/adviser/dashboard?tab=reviews", tabName: "reviews", icon: FileSearch },
  { label: "Consultations", href: "/adviser/dashboard?tab=consultations", tabName: "consultations", icon: Calendar },
  { label: "Calendar", href: "/adviser/calendar", icon: Calendar },
  { label: "Messages", href: "/adviser/dashboard?tab=group-chats", tabName: "group-chats", icon: MessageSquare },
  { label: "Inbox", href: "/adviser/inbox", icon: Mail },
];

export function AdviserSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Faculty Adviser"
      roleBadge="ADVISER PORTAL"
      navItems={NAV_ITEMS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/adviser/settings"
      profileHref="/adviser/profile"
      variant="workspace"
    />
  );
}
