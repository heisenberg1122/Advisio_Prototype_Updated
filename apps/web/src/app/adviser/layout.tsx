"use client";

import React, { Suspense } from "react";
import { Providers } from "@/providers";
import { AdviserSidebar } from "@/components/dashboards/adviser/AdviserSidebar";
import { AdviserTopbar } from "@/components/dashboards/adviser/AdviserTopbar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

function AdviserLayoutInner({ children }: { children: React.ReactNode }) {
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
        <AdviserSidebar />
      </Suspense>

      <div className="flex flex-col bg-slate-50 overflow-hidden text-slate-800 min-w-0">
        <Suspense fallback={<header className="h-[52px] bg-white border-b border-slate-200" />}>
          <AdviserTopbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdviserLayout({ children }: { children: React.ReactNode }) {
  return <AdviserLayoutInner>{children}</AdviserLayoutInner>;
}
