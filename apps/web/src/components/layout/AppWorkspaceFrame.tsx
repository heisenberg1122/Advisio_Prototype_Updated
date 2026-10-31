"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import "./workspace-layout.css";

interface AppWorkspaceFrameProps {
  children: React.ReactNode;
  collapsed: boolean;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  dashboardPath?: string;
  padSecondaryPages?: boolean;
}

export function AppWorkspaceFrame({
  children,
  collapsed,
  sidebar,
  topbar,
}: AppWorkspaceFrameProps) {
  const { isDark } = useTheme();

  return (
    <div
      className={cn(
        "min-h-screen bg-[var(--sidebar-background)] text-[var(--color-text-primary)]",
        isDark && "dark"
      )}
    >
      {sidebar}

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-all duration-300 ease-in-out bg-[var(--sidebar-background)]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        )}
      >
        {topbar}
        <main
          data-workspace-layout="standard"
          className={cn(
            "app-workspace flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col rounded-tl-[32px] bg-white dark:bg-[var(--color-surface)] border-0 outline-none shadow-none"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
