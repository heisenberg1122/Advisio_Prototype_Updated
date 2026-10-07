"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  UserCheck,
  Clock,
  FileText,
  FolderOpen,
  Calendar,
  MessageSquare,
  Mail,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/student/dashboard", tabName: "overview", icon: LayoutDashboard },
  { label: "My Project", href: "/student/dashboard?tab=group", tabName: "group", icon: FolderKanban },
  { label: "Group Files", href: "/student/group-files", icon: FolderOpen },
  { label: "Tasks", href: "/student/tasks", icon: CheckSquare },
  { label: "Adviser Pool", href: "/student/adviser-pool", icon: UserCheck },
  { label: "Timeline", href: "/student/dashboard?tab=milestones", tabName: "milestones", icon: Clock },
  { label: "Documents", href: "/student/documents", icon: FileText },
  { label: "Consultations", href: "/student/dashboard?tab=consultations", tabName: "consultations", icon: Calendar },
  { label: "Calendar", href: "/student/calendar", icon: Calendar },
  { label: "Messages", href: "/student/dashboard?tab=group-chats", tabName: "group-chats", icon: MessageSquare },
  { label: "Inbox", href: "/student/inbox", icon: Mail },
];

export function StudentSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <AppSidebar
      roleTitle="Student Researcher"
      roleBadge="RESEARCHER PANEL"
      navItems={NAV_ITEMS}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/student/settings"
      profileHref="/student/profile"
      variant="workspace"
    />
  );
}
