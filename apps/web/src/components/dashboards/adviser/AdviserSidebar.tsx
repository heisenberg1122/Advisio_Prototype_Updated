"use client";

import { usePathname } from "next/navigation";
import { AppSidebar, NavSection } from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { Bell,
  LayoutDashboard,
  Users,
  FileSearch,
  CalendarClock,
  CalendarDays,
  MessageSquare,
  Mail,
  Archive,
} from "lucide-react";

export const ADVISER_NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      { label: "Overview", href: "/adviser/dashboard", tabName: "overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "ADVISEE MANAGEMENT",
    items: [
      { label: "My Advisees", href: "/adviser/dashboard?tab=advisees", tabName: "advisees", icon: Users },
      { label: "Reviews", href: "/adviser/reviews", icon: FileSearch },
      { label: "Official Copies", href: "/adviser/documents?tab=official", icon: Archive },
    ],
  },
  {
    title: "ACADEMIC ACTIVITIES",
    items: [
      { label: "Consultations", href: "/adviser/dashboard?tab=consultations", tabName: "consultations", icon: CalendarClock },
      { label: "Calendar", href: "/adviser/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "COMMUNICATION",
    items: [
      { label: "Messages", href: "/adviser/dashboard?tab=group-chats", tabName: "group-chats", icon: MessageSquare },
      { label: "Inbox", href: "/adviser/inbox", icon: Mail },
      { label: "Notifications", href: "/adviser/notifications", icon: Bell },
    ],
  },
];

export function AdviserSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const pathname = usePathname() || "";
  const navSections = ADVISER_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      ({
        ...item,
        guideTarget: "adviser-nav-" + (item.tabName || item.href.split("?")[0].split("/").at(-1)),
        ...(item.tabName === "advisees" && pathname.startsWith("/adviser/advisees/") ? { active: true } : {}),
      }),
    ),
  }));

  return (
    <AppSidebar
      roleTitle="Faculty Adviser"
      roleBadge="ADVISER PORTAL"
      navSections={navSections}
      groupedNavigation
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/adviser/settings"
      variant="workspace"
    />
  );
}
