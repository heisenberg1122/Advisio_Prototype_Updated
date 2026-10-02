"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpenCheck, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, ClipboardList, FileBarChart, GraduationCap, LayoutDashboard, LogOut, Settings, UserRound, UsersRound } from "lucide-react";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { useProfile } from "@/hooks/use-profile";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useAuth } from "@/hooks/use-auth";

const navigation = [
  { label: "Overview", tab: "overview", icon: LayoutDashboard },
  { label: "Students", tab: "students", icon: UserRound },
  { label: "Research Groups", tab: "research", icon: BookOpenCheck },
  { label: "Progress & Risk", tab: "progress", icon: ChartNoAxesCombined },
  { label: "Advisers", tab: "advisers", icon: UsersRound },
  { label: "Defenses", tab: "defenses", icon: ClipboardList },
  { label: "Calendar", tab: "calendar", icon: CalendarDays },
  { label: "Reports", tab: "reports", icon: FileBarChart },
];

function Sidebar() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { collapsed, toggle } = useSidebarCollapsed();
  const { profile } = useProfile();
  const { logout } = useAuth();
  return <aside className={`relative flex h-screen flex-col bg-[#0e3553] text-white transition-[width] duration-300 ${collapsed ? "w-18" : "w-64"}`}>
    <button onClick={toggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="absolute -right-3 top-24 z-20 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#f6a800] text-[#102f49] shadow-lg">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
    <div className={`flex h-20 items-center border-b border-white/10 ${collapsed ? "justify-center" : "px-5"}`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6a800] text-[#102f49]"><GraduationCap className="h-6 w-6" /></span>{!collapsed && <div className="ml-3"><p className="text-lg font-black tracking-[.06em]">ADVISIO</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#f6c453]">Dean Portal</p></div>}</div>
    <div className={`border-b border-white/10 py-5 ${collapsed ? "px-3" : "px-5"}`}>{!collapsed ? <><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Workspace</p><p className="mt-2 text-sm font-bold">College research</p><p className="mt-1 text-[11px] text-slate-400">Operational monitoring</p></> : <div className="mx-auto h-1.5 w-6 rounded-full bg-[#f6a800]" />}</div>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">{navigation.map((item) => { const active = activeTab === item.tab; return <Link key={item.tab} href={item.tab === "overview" ? "/admin/dashboard" : `/admin/dashboard?tab=${item.tab}`} title={collapsed ? item.label : undefined} className={`flex h-11 items-center rounded-xl text-sm transition ${collapsed ? "justify-center" : "gap-3 px-3"} ${active ? "bg-[#f6a800] font-extrabold text-[#102f49] shadow-lg shadow-black/10" : "text-slate-300 hover:bg-white/[.07] hover:text-white"}`}><item.icon className="h-[19px] w-[19px] shrink-0" />{!collapsed && <span>{item.label}</span>}</Link>; })}</nav>
    <div className="border-t border-white/10 p-3">
      <Link href="/admin/dashboard?tab=settings" className={`flex h-10 items-center rounded-xl text-slate-300 hover:bg-white/[.07] ${collapsed ? "justify-center" : "gap-3 px-3"}`}><Settings className="h-[18px] w-[18px]" />{!collapsed && <span className="text-sm">Preferences</span>}</Link>
      <Link href="/admin/profile" className={`mt-2 flex items-center rounded-xl bg-white/[.06] py-2 ${collapsed ? "justify-center" : "gap-3 px-2"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#0e3553]">{profile?.initials || "DO"}</span>{!collapsed && <div className="min-w-0"><p className="truncate text-xs font-extrabold">{profile?.name || "Dean’s Office"}</p><p className="text-[10px] text-slate-400">College administrator</p></div>}</Link>
      <button
        onClick={logout}
        title={collapsed ? "Sign Out" : undefined}
        className={`mt-2 flex h-10 w-full items-center rounded-xl text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition cursor-pointer ${collapsed ? "justify-center" : "gap-3 px-3"}`}
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="text-sm font-semibold">Sign Out</span>}
      </button>
    </div>
  </aside>;
}

function Topbar() {
  const pathname = usePathname();
  return <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Dean administration</p><p className="text-sm font-bold text-[#102f49]">Research Management Center</p></div><div className="flex items-center gap-3"><NotificationPopover viewAllHref="/admin/notifications" /></div></header>;
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed();
  return <div className="grid h-screen overflow-hidden bg-[#f4f7fa]" style={{ gridTemplateColumns: collapsed ? "72px minmax(0,1fr)" : "256px minmax(0,1fr)", transition: "grid-template-columns 300ms ease" }}><Sidebar /><div className="flex min-w-0 flex-col overflow-hidden"><Topbar /><main className="min-h-0 flex-1 overflow-y-auto">{children}</main></div></div>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<div className="min-h-screen bg-[#f4f7fa]" />}><AdminLayoutContent>{children}</AdminLayoutContent></Suspense>; }
