"use client";

import React, { Suspense } from "react";
import { StudentSidebar } from "@/components/dashboards/student/StudentSidebar";
import { StudentTopbar } from "@/components/dashboards/student/StudentTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <AppWorkspaceFrame
      collapsed={collapsed}
      sidebar={
        <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[240px] bg-[#F4F6F8] dark:bg-[#080E18] lg:block" />}>
          <StudentSidebar />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<header className="h-[72px] bg-[#F4F6F8] dark:bg-[#080E18]" />}>
          <StudentTopbar />
        </Suspense>
      }
    >
      {children}
    </AppWorkspaceFrame>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutInner>{children}</StudentLayoutInner>;
}
