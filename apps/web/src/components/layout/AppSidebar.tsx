"use client";

import React from "react";
import Link from "next/link";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { NavItem, NavItemProps } from "./NavItem";
import { useAuth } from "@/hooks/use-auth";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";

export interface NavSection {
  title?: string;
  items: NavItemProps[];
}

export interface AppSidebarProps {
  roleTitle: string;
  roleBadge: string;
  navItems?: NavItemProps[];
  navSections?: NavSection[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  settingsHref?: string;
  profileHref?: string;
  variant?: "default" | "workspace";
}

export function AppSidebar({
  roleTitle,
  roleBadge,
  navItems,
  navSections,
  collapsed = false,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  settingsHref = "/student/settings",
}: AppSidebarProps) {
  const { logout } = useAuth();
  const { mobileOpen, closeMobile, toggle } = useSidebarCollapsed();
  const resolvedMobileOpen = isMobileOpen ?? mobileOpen;
  const handleMobileClose = onMobileClose ?? closeMobile;
  const handleToggle = onToggleCollapse ?? toggle;
  const isVisuallyCollapsed = collapsed && !resolvedMobileOpen;

  const sections: NavSection[] = navSections || [
    {
      items: navItems || [],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {resolvedMobileOpen && (
        <div
          onClick={handleMobileClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Google Classroom-Inspired Course Navigation Sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col text-[var(--color-text-primary)] transition-all duration-300 ease-in-out dark:text-slate-200",
          "bg-[var(--sidebar-background)]",
          isVisuallyCollapsed ? "w-[72px]" : "w-[260px]",
          resolvedMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={handleMobileClose}
          className="absolute right-3 top-4 rounded-xl p-2 text-slate-500 hover:bg-black/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white lg:hidden cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Google Classroom-Inspired Header with Hamburger & Logo */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center transition-all",
            isVisuallyCollapsed ? "justify-center px-2" : "gap-3 px-4",
          )}
        >
          {handleToggle && (
            <button
              type="button"
              onClick={handleToggle}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] dark:text-slate-300"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5 stroke-[2]" />
            </button>
          )}

          {!isVisuallyCollapsed && (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-[var(--color-border)]">
              <img
                src="/ao-logo.png"
                alt="Advisio"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {!isVisuallyCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className="font-sans text-base font-bold tracking-tight text-[var(--color-text-primary)] dark:text-white">
                  ADVISIO
                </span>
              </div>
              <div className="text-xs font-semibold uppercase leading-tight tracking-wider text-[var(--color-primary)]">
                {roleBadge || roleTitle}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Body */}
        <nav
          className="flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 space-y-1"
          aria-label="Sidebar Navigation"
        >
          {sections.map((section, sIndex) => (
            <div
              key={section.title || sIndex}
              className={cn(
                "space-y-1",
                isVisuallyCollapsed && "flex w-full flex-col items-center",
              )}
            >
              {section.title && !isVisuallyCollapsed && (
                <div className="px-4 pb-1.5 pt-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem
                  key={item.href + item.label}
                  {...item}
                  collapsed={isVisuallyCollapsed}
                  onClick={handleMobileClose}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Utility Footer */}
        <div
          className={cn(
            "w-full shrink-0 space-y-1 p-2.5",
            isVisuallyCollapsed && "flex flex-col items-center",
          )}
        >
          {/* Settings Link */}
          <Link
            href={settingsHref}
            onClick={handleMobileClose}
            title={isVisuallyCollapsed ? "Settings" : undefined}
            className={cn(
              "flex h-11 items-center select-none outline-none transition-colors duration-150 rounded-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]",
              isVisuallyCollapsed
                ? "w-11 justify-center p-0"
                : "mx-1 gap-3.5 px-3.5 text-sm font-medium",
              "text-[var(--color-text-primary)]/80 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)] dark:text-slate-300",
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isVisuallyCollapsed && <span className="text-sm">Settings</span>}
          </Link>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              handleMobileClose();
              logout();
            }}
            title={isVisuallyCollapsed ? "Sign Out" : undefined}
            className={cn(
              "flex h-11 w-full items-center select-none outline-none transition-colors duration-150 rounded-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400/50",
              isVisuallyCollapsed
                ? "w-11 justify-center p-0"
                : "mx-1 gap-3.5 px-3.5 text-sm font-medium",
              "text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/15",
            )}
            aria-label="Sign Out"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isVisuallyCollapsed && (
              <span className="text-sm font-medium">Sign Out</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
