"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut, Menu, Settings, X } from "lucide-react";
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
  variant = "default",
}: AppSidebarProps) {
  const { logout } = useAuth();
  const { mobileOpen, closeMobile } = useSidebarCollapsed();
  const resolvedMobileOpen = isMobileOpen ?? mobileOpen;
  const handleMobileClose = onMobileClose ?? closeMobile;
  const isWorkspace = variant === "workspace";
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

      {/* Shared institutional sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col text-slate-700 transition-all duration-300 ease-in-out dark:text-slate-200",
          isWorkspace
            ? "border-0 bg-[#F4F6F8] shadow-none dark:bg-[#080E18]"
            : "border-r border-slate-200 bg-white shadow-[2px_0_12px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[#0D1525]",
          collapsed
            ? isWorkspace ? "lg:w-[72px]" : "lg:w-[68px]"
            : isWorkspace ? "lg:w-[240px]" : "lg:w-[260px]",
          resolvedMobileOpen ? "translate-x-0 w-[270px]" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Collapse Toggle Button (Desktop Only) */}
        {onToggleCollapse && !isWorkspace && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3.5 top-1/2 z-50 hidden h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-[#0B3A53] shadow-md outline-none transition-all hover:scale-110 hover:border-[#0B3A53] focus:outline-none dark:border-white/20 dark:bg-[#0D1525] dark:text-[#FFA400]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            ) : (
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            )}
          </button>
        )}

        {/* Mobile Close Button */}
        <button
          onClick={handleMobileClose}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Institutional Branding Header */}
        <div
          className={cn(
            "flex shrink-0 items-center transition-all",
            isWorkspace ? "h-[72px] border-0" : "h-16 border-b border-slate-200 dark:border-white/10",
            isVisuallyCollapsed ? "justify-center px-2" : isWorkspace ? "gap-2 px-4" : "gap-3 px-5"
          )}
        >
          {isWorkspace && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-[#0B3A53] lg:flex dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {!isVisuallyCollapsed && (
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-slate-200/70 dark:ring-white/10">
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
                <span className="font-sans text-base font-black tracking-tight text-[#0B3A53] dark:text-white">
                  ADVISIO
                </span>
              </div>
              <div className="text-xs font-bold uppercase leading-tight tracking-tighter text-slate-500 dark:text-slate-400">
                {roleBadge || roleTitle}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Body */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden space-y-4",
            isWorkspace ? "px-2 py-2.5" : "px-1 py-3"
          )}
          aria-label="Sidebar Navigation"
        >
          {sections.map((section, sIndex) => (
            <div key={section.title || sIndex} className="space-y-1.5">
              {section.title && !isVisuallyCollapsed && (
                <div className="px-5 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <NavItem
                  key={item.href + item.label}
                  {...item}
                  collapsed={isVisuallyCollapsed}
                  onClick={handleMobileClose}
                  appearance={isWorkspace ? "workspace" : "default"}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Utility Footer */}
        <div className={cn(
          "shrink-0 space-y-1.5 p-3",
          isWorkspace ? "border-0" : "border-t border-slate-200 dark:border-white/10"
        )}>
          {/* Settings Link */}
          <Link
            href={settingsHref}
            onClick={handleMobileClose}
            title={isVisuallyCollapsed ? "Settings" : undefined}
            className={cn(
              "flex h-11 items-center rounded-xl text-slate-600 transition-all select-none outline-none hover:bg-slate-100 hover:text-[#0B3A53] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
              isVisuallyCollapsed ? "justify-center px-0 w-11 h-11 mx-auto" : "gap-3.5 px-3.5 mx-1 text-[15px] font-medium"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isVisuallyCollapsed && <span className="text-[15px]">Settings</span>}
          </Link>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              handleMobileClose();
              logout();
            }}
            title={isVisuallyCollapsed ? "Sign Out" : undefined}
            className={cn(
              "flex h-11 w-full cursor-pointer items-center rounded-xl text-rose-600 transition-all select-none outline-none hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200",
              isVisuallyCollapsed ? "justify-center px-0 w-11 h-11 mx-auto" : "gap-3.5 px-3.5 mx-1 text-[15px] font-medium"
            )}
            aria-label="Sign Out"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isVisuallyCollapsed && <span className="text-[15px] font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
