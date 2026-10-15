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
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[260px] bg-[var(--sidebar-background)] lg:block" />}>
          <ProfessorSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-16 bg-[var(--header-background)]" />}>
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
