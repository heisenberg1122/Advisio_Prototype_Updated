"use client";

import React, { useState } from "react";
import { AppSidebar, NavSection } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { NavItemProps } from "./NavItem";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  roleTitle: string;
  roleBadge: string;
  navItems?: NavItemProps[];
  navSections?: NavSection[];
  title?: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  notificationsHref?: string;
  settingsHref?: string;
  profileHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  hideTopbar?: boolean;
}

export function AppShell({
  roleTitle,
  roleBadge,
  navItems,
  navSections,
  title,
  subtitle,
  breadcrumbs,
  notificationsHref,
  settingsHref,
  profileHref,
  actions,
  children,
  contentClassName,
  hideTopbar = false,
}: AppShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F9FB] dark:bg-[#080E18] text-[#17212B] dark:text-[#F1F5F9] font-sans antialiased">
      {/* Universal Institutional Sidebar */}
      <AppSidebar
        roleTitle={roleTitle}
        roleBadge={roleBadge}
        navItems={navItems}
        navSections={navSections}
        collapsed={collapsed}
        onToggleCollapse={toggle}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        settingsHref={settingsHref}
        profileHref={profileHref}
      />

      {/* Main Layout Area */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:pl-[68px]" : "lg:pl-[260px]"
        )}
      >
        {/* Universal Topbar */}
        {!hideTopbar && (
          <AppTopbar
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            notificationsHref={notificationsHref}
            settingsHref={settingsHref}
            profileHref={profileHref}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            actions={actions}
          />
        )}

        {/* Scrollable Main Content Container */}
        <main
          className={cn(
            "flex-1 overflow-x-hidden min-w-0",
            contentClassName || "p-4 sm:p-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
