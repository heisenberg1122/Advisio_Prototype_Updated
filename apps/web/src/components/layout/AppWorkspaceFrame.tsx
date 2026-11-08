"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { workspaceViewForLocation } from "@/lib/workspace-appearance";
import { useTheme } from "@/providers/theme-provider";
import "./workspace-layout.css";
import type { NavSection } from "./AppSidebar";
import { WorkspaceSectionNavigation } from "./GroupedWorkspaceNavigation";

interface AppWorkspaceFrameProps {
  children: React.ReactNode;
  collapsed: boolean;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  dashboardPath?: string;
  padSecondaryPages?: boolean;
  workspaceSections?: NavSection[];
}

export function AppWorkspaceFrame({
  children,
  collapsed,
  sidebar,
  topbar,
  workspaceSections,
}: AppWorkspaceFrameProps) {
  const { isDark } = useTheme();
  const { pathname, search } = useLocation();

  return (
    <div
      className={cn(
        "workspace-frame min-h-screen bg-[var(--sidebar-background)] text-[var(--color-text-primary)]",
        isDark && "dark"
      )}
    >
      {sidebar}

      <div
        className={cn(
          "workspace-frame__body flex min-h-screen min-w-0 flex-col transition-all duration-300 ease-in-out bg-[var(--sidebar-background)]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        )}
      >
        {topbar}
        <main
          data-workspace-layout="standard"
          data-workspace-view={workspaceViewForLocation(pathname, search)}
          className={cn(
            "app-workspace flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col border-0 outline-none shadow-none"
          )}
        >
          {workspaceSections && <WorkspaceSectionNavigation sections={workspaceSections} />}
          {children}
        </main>
      </div>
    </div>
  );
}
