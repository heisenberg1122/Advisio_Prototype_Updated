"use client";

import React, { Suspense } from "react";
import { AdviserSidebar } from "@/components/dashboards/adviser/AdviserSidebar";
import { AdviserTopbar } from "@/components/dashboards/adviser/AdviserTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function AdviserLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath="/adviser/dashboard"
      padSecondaryPages
      sidebar={
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[240px] bg-[#F4F6F8] dark:bg-[#080E18] lg:block" />}>
          <AdviserSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-[72px] bg-[#F4F6F8] dark:bg-[#080E18]" />}>
          <AdviserTopbar />
        </Suspense>
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function AdviserLayout({ children }: { children: React.ReactNode }) {
  return <AdviserLayoutInner>{children}</AdviserLayoutInner>;
}
