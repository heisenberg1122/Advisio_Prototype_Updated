"use client";

import React, { Suspense } from "react";
import { Providers } from "@/providers";
import { PanelistSidebar } from "@/components/dashboards/panelist/PanelistSidebar";
import { PanelistTopbar } from "@/components/dashboards/panelist/PanelistTopbar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function PanelistLayoutInner({ children }: { children: React.ReactNode }) {
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
        <PanelistSidebar />
      </Suspense>

      <div className="flex flex-col bg-slate-50 overflow-hidden text-slate-800 min-w-0">
        <Suspense fallback={<header className="h-[52px] bg-white border-b border-slate-200" />}>
          <PanelistTopbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PanelistLayout({ children }: { children: React.ReactNode }) {
  return <PanelistLayoutInner>{children}</PanelistLayoutInner>;
}
