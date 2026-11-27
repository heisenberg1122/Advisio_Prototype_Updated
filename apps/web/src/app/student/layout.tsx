"use client";

import React, { Suspense } from "react";
import { ResearchWorkspaceNavigation, StudentSidebar } from "@/components/dashboards/student/StudentSidebar";
import { StudentTopbar } from "@/components/dashboards/student/StudentTopbar";
import { AppWorkspaceFrame } from "@/components/layout/AppWorkspaceFrame";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import "./researcher-workspace-surfaces.css";
import { WorkspaceMotion } from '@/components/dashboards/student/WorkspaceMotion';
import { OfflineStatus } from '@/components/offline/OfflineStatus';
import { useOfflineReadOnly, useOfflineSession } from '@/components/offline/use-offline';
import { supportsOfflinePage } from '@/lib/offline/access';
import { useLocation } from 'react-router-dom';

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();
  const readOnly = useOfflineReadOnly();
  const { session, loading } = useOfflineSession();
  const { pathname, search } = useLocation();
  const available = supportsOfflinePage(pathname, search);

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
        <OfflineStatus />
        <ResearchWorkspaceNavigation />
        <WorkspaceMotion>{readOnly && (loading || !session || !available) ? <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-primary)]"><h1 className="text-xl font-bold">{loading ? "Checking saved information…" : !session ? "Offline access is not available on this device" : "This section needs an internet connection"}</h1><p className="mt-3 text-base">{!session ? "Connect to the internet and enable offline saving from Offline settings. Your current sign-in may also have expired." : "Use the normal navigation to open saved Home, Tasks, Documents, or Guides. Your drafts stay on this device."}</p></section> : children}</WorkspaceMotion>
      </AppWorkspaceFrame>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutInner>{children}</StudentLayoutInner>;
}
