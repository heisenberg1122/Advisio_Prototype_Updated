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
    <div className="min-h-screen bg-[var(--sidebar-background)] text-[var(--color-text-primary)] font-sans antialiased">
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
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out bg-[var(--sidebar-background)]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
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
            "app-workspace flex min-h-[calc(100vh-4rem)] flex-1 min-w-0 flex-col rounded-tl-[32px] bg-white dark:bg-[var(--color-surface)] border-0 outline-none shadow-none",
            contentClassName || "p-4 sm:p-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
