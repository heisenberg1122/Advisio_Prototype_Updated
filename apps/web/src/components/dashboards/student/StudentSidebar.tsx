"use client";

import React, { useId, useState } from "react";
import { LayoutGroup } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NavItem, type NavItemProps } from "@/components/layout/NavItem";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import { researcherDestination, WORKSPACE_SECTIONS } from "@/lib/researcher-navigation";
import {
  LayoutDashboard, FolderKanban, Users, CheckSquare, FileText, Clock,
  GraduationCap, Presentation, CalendarDays, CalendarClock,
  MessageSquare, Mail, Bell, ChevronDown,
} from "lucide-react";

const workspaceIcons = { overview: FolderKanban, group: Users, tasks: CheckSquare, documents: FileText, timeline: Clock };
const groups: Array<{
  id: string;
  label: string;
  icon: Exclude<NavItemProps["icon"], string>;
  items: Array<NavItemProps & { id: string }>;
}> = [
  {
    id: "workspace", label: "Research Workspace", icon: FolderKanban,
    items: WORKSPACE_SECTIONS.map(({ id, sidebarLabel, href }) => ({
      id, label: sidebarLabel, href, icon: workspaceIcons[id],
    })),
  },
  {
    id: "academic", label: "Academic Activities", icon: GraduationCap,
    items: [
      { id: "defense", label: "Defense", href: "/student/defense", icon: Presentation },
      { id: "grades", label: "My Grades", href: "/student/grades", icon: GraduationCap },
    ],
  },
  {
    id: "schedule", label: "Schedule", icon: CalendarDays,
    items: [
      { id: "consultations", label: "Consultations", href: "/student/dashboard?tab=consultations", icon: CalendarClock },
      { id: "calendar", label: "Calendar", href: "/student/calendar", icon: CalendarDays },
    ],
  },
  {
    id: "communication", label: "Communication", icon: MessageSquare,
    items: [
      { id: "messages", label: "Messages", href: "/student/dashboard?tab=group-chats", icon: MessageSquare },
      { id: "inbox", label: "Inbox", href: "/student/inbox", icon: Mail },
      { id: "notifications", label: "Notifications", href: "/student/notifications", icon: Bell },
    ],
  },
];

function StudentNavigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const destination = researcherDestination(usePathname(), useSearchParams());
  const { projectHref } = useActiveProjectContext();
  const activeGroup = groups.find(({ items }) => items.some(({ id }) => id === destination))?.id;
  const [disclosure, setDisclosure] = useState<{ from: string | null; open?: string }>();
  const openGroup = disclosure && disclosure.from === destination ? disclosure.open : activeGroup;
  const navId = useId();

  return (
    <div className="researcher-navigation">
      <NavItem guideTarget="nav-home" label="Home" href={projectHref("/student/dashboard")} icon={LayoutDashboard} active={destination === "home"} collapsed={collapsed} onClick={onNavigate} />
      {groups.map(({ id, label, icon: Icon, items }) => {
        const open = id === openGroup;
        const active = id === activeGroup;
        const controlsId = `${navId}-${id}`;
        return (
          <div key={id} className="researcher-navigation-group">
            <button
              type="button"
              className="researcher-navigation-trigger"
              data-guide={`nav-section-${id}`}
              data-active={active}
              data-collapsed={collapsed}
              title={collapsed ? label : undefined}
              aria-label={active ? `${label}, current section` : label}
              aria-expanded={open}
              aria-controls={controlsId}
              onClick={() => setDisclosure({ from: destination, open: open ? undefined : id })}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {!collapsed && <><span>{label}</span><ChevronDown className="researcher-navigation-chevron size-4 shrink-0" aria-hidden="true" /></>}
            </button>
            <div className="researcher-navigation-children" id={controlsId} hidden={!open} data-collapsed={collapsed}>
              {items.map(({ id: itemId, href, ...item }) => (
                <NavItem key={itemId} guideTarget={`nav-${itemId}`} {...item} href={projectHref(href)} active={destination === itemId} collapsed={collapsed} onClick={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StudentSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    <LayoutGroup id="researcher-navigation">
    <AppSidebar
      roleTitle="Student Researcher"
      roleBadge="RESEARCHER PANEL"
      renderNavigation={(options) => <StudentNavigation {...options} />}
      collapsed={collapsed}
      onToggleCollapse={toggle}
      settingsHref="/student/settings"
      profileHref="/student/profile"
      variant="workspace"
    />
    </LayoutGroup>
  );
}

export function ResearchWorkspaceNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const destination = researcherDestination(pathname, params);
  const { projectHref } = useActiveProjectContext();
  if (!WORKSPACE_SECTIONS.some(({ id }) => id === destination)) return null;
  const documentArea = pathname.replace(/\/$/, "") === "/student/group-files" ? "group-files" : pathname === "/student/dashboard" && ["submissions", "submission", "version-control"].includes(params.get("tab") || "") ? "submissions" : "workspace";

  return (
    <div className="researcher-workspace-nav">
      <nav aria-label="Research Workspace sections">
        {WORKSPACE_SECTIONS.map(({ id, label, href }) => (
          <Link key={id} href={projectHref(href)} aria-current={id === destination ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      {destination === "documents" && (
        <nav aria-label="Document areas" className="researcher-document-nav">
          <Link data-guide="documents-workspace-tab" href={projectHref("/student/documents")} aria-current={documentArea === "workspace" ? "page" : undefined}>Document workspace</Link>
          <Link data-guide="documents-submissions-tab" href={projectHref("/student/dashboard?tab=submissions")} aria-current={documentArea === "submissions" ? "page" : undefined}>Submission history</Link>
          <Link data-guide="documents-files-tab" href={projectHref("/student/group-files")} aria-current={documentArea === "group-files" ? "page" : undefined}>Group Files</Link>
        </nav>
      )}
    </div>
  );
}
