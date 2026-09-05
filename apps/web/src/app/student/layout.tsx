"use client";

import React, { Suspense } from "react";
import { Providers } from "@/providers";
import { StudentSidebar } from "@/components/dashboards/student/StudentSidebar";
import { StudentTopbar } from "@/components/dashboards/student/StudentTopbar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div
      className="h-full min-h-screen text-slate-100"
      style={{
        display: "grid",
        gridTemplateColumns: collapsed ? "64px 1fr" : "240px 1fr",
        transition: "grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Suspense fallback={<div className="bg-[#1b4264] w-[240px] h-full" />}>
        <StudentSidebar />
      </Suspense>

      <div className="flex flex-col bg-slate-50 overflow-hidden text-slate-800 min-w-0">
        <Suspense fallback={<header className="h-[52px] bg-white border-b border-slate-200" />}>
          <StudentTopbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutInner>{children}</StudentLayoutInner>;
}
