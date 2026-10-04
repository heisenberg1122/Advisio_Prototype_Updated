"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  dashboardPath,
  padSecondaryPages = false,
}: AppWorkspaceFrameProps) {
  const pathname = usePathname() || "";
  const shouldPadContent =
    padSecondaryPages && Boolean(dashboardPath) && pathname !== dashboardPath;

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#17212B] dark:bg-[#080E18] dark:text-[#F1F5F9]">
      {sidebar}

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[240px]"
        )}
      >
        {topbar}
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col px-2 pb-2 sm:px-4 sm:pb-4 lg:pr-6 lg:pb-6",
            collapsed ? "lg:pl-2" : "lg:pl-6"
          )}
        >
          <div
            className={cn(
              "app-workspace min-h-[calc(100vh-80px)] flex-1 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:bg-[#101B2B] sm:min-h-[calc(100vh-88px)] lg:min-h-[calc(100vh-96px)] lg:rounded-[20px]",
              shouldPadContent && "p-4 sm:p-6 lg:p-8"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
