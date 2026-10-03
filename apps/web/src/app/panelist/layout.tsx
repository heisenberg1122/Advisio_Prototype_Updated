"use client";

import React, { Suspense } from "react";
import { PanelistSidebar } from "@/components/dashboards/panelist/PanelistSidebar";
import { PanelistTopbar } from "@/components/dashboards/panelist/PanelistTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function PanelistLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath="/panelist/dashboard"
      padSecondaryPages
      sidebar={
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[240px] bg-[#F4F6F8] dark:bg-[#080E18] lg:block" />}>
          <PanelistSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-[72px] bg-[#F4F6F8] dark:bg-[#080E18]" />}>
          <PanelistTopbar />
        </Suspense>
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function PanelistLayout({ children }: { children: React.ReactNode }) {
  return <PanelistLayoutInner>{children}</PanelistLayoutInner>;
}
