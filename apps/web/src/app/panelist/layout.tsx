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
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[260px] bg-[var(--sidebar-background)] lg:block" />}>
          <PanelistSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-16 bg-[var(--header-background)]" />}>
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
