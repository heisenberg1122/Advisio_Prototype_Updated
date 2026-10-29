"use client";

import React, { Suspense } from "react";
import { StudentSidebar } from "@/components/dashboards/student/StudentSidebar";
import { StudentTopbar } from "@/components/dashboards/student/StudentTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import "./researcher-workspace-surfaces.css";

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();

  return (
    <div className="researcher-shell">
      <AppWorkspaceFrame
        collapsed={collapsed}
        sidebar={
          <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[260px] bg-[var(--sidebar-background)] lg:block" />}>
            <StudentSidebar />
          </Suspense>
        }
        topbar={
          <Suspense fallback={<header className="h-16 bg-[var(--header-background)]" />}>
            <StudentTopbar />
          </Suspense>
        }
      >
        {children}
      </AppWorkspaceFrame>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutInner>{children}</StudentLayoutInner>;
}
