"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { NavSection } from "./AppSidebar";
import { NavItem } from "./NavItem";
import { navigationItemActive } from "@/lib/navigation-item-active";
import "./grouped-workspace-navigation.css";

function sectionLabel(title: string) {
  return title.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

export function GroupedWorkspaceNavigation({ sections, collapsed, onNavigate }: {
  sections: NavSection[];
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { pathname, search } = useLocation();
  const destination = pathname + search;
  const activeGroup = sections.findIndex(section => section.items.some(item => navigationItemActive(item, pathname, search)));
  const [disclosure, setDisclosure] = useState<{ from: string; open: number | null }>();
  const openGroup = disclosure?.from === destination ? disclosure.open : activeGroup;
  const navId = useId();

  return <div className="portal-navigation">
    {sections.map((section, index) => {
      if (!section.items.length) return null;
      if (!section.title || section.title === "HOME") return <div key={index}>
        {section.items.map(item => <NavItem key={item.href} {...item} label={item.tabName === "overview" ? "Home" : item.label} collapsed={collapsed} onClick={onNavigate} />)}
      </div>;
      const Icon = section.items[0].icon;
      const label = sectionLabel(section.title);
      const controlsId = `${navId}-${index}`;
      return <div key={section.title}>
        <button type="button" className="portal-navigation-trigger" data-active={activeGroup === index} data-collapsed={collapsed}
          title={collapsed ? label : undefined} aria-label={activeGroup === index ? `${label}, current section` : label}
          aria-expanded={openGroup === index} aria-controls={controlsId}
          onClick={() => setDisclosure({ from: destination, open: openGroup === index ? null : index })}>
          {typeof Icon === "string" ? <i className={`ti ${Icon}`} aria-hidden="true" /> : <Icon className="size-5 shrink-0" />}
          {!collapsed && <><span>{label}</span><ChevronDown className="portal-navigation-chevron size-4 shrink-0" aria-hidden="true" /></>}
        </button>
        <div id={controlsId} hidden={openGroup !== index} className="portal-navigation-children" data-collapsed={collapsed}>
          {section.items.map(item => <NavItem key={item.href} {...item} collapsed={collapsed} onClick={onNavigate} />)}
        </div>
      </div>;
    })}
  </div>;
}

export function WorkspaceSectionNavigation({ sections }: { sections: NavSection[] }) {
  const { pathname, search } = useLocation();
  // Only the role's primary work area has local tabs. Home, schedule and
  // communication retain their own page navigation.
  const section = sections[1];
  if (!section || !section.items.some(item => navigationItemActive(item, pathname, search))) return null;
  return <nav className="portal-workspace-tabs" aria-label={`${sectionLabel(section.title || "Workspace")} sections`}>
    {section.items.map(item => <Link key={item.href} href={item.href} aria-current={navigationItemActive(item, pathname, search) ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
