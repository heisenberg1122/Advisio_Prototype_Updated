"use client";

import React, { Suspense } from "react";
import { ProfessorSidebar } from "@/components/dashboards/professor/ProfessorSidebar";
import { ProfessorTopbar } from "@/components/dashboards/professor/ProfessorTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function ProfessorLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      dashboardPath="/professor/dashboard"
      padSecondaryPages
      sidebar={
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[240px] bg-[#F4F6F8] dark:bg-[#080E18] lg:block" />}>
          <ProfessorSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-[72px] bg-[#F4F6F8] dark:bg-[#080E18]" />}>
          <ProfessorTopbar />
        </Suspense>
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return <ProfessorLayoutInner>{children}</ProfessorLayoutInner>;
}
