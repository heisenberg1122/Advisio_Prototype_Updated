"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { useProfile } from "@/hooks/use-profile";

const TITLES: Record<string, string> = { overview: "Dashboard", schedule: "Defense Schedule", documents: "Research Documents", evaluation: "Evaluations", evaluations: "Evaluations", grades: "Results & Recommendations", history: "Evaluation History", settings: "Settings" };
const PAGES: Record<string, string> = { "/panelist/schedule": "Defense Schedule", "/panelist/evaluations": "Research Documents", "/panelist/scoring": "Evaluation & Scoring", "/panelist/profile": "My Profile", "/panelist/profile/edit": "Edit Profile", "/panelist/notifications": "Notifications" };

export function PanelistTopbar() {
  const pathname = usePathname() || "";
  const tab = useSearchParams().get("tab") || "overview";
  const { profile } = useProfile();
  const title = pathname === "/panelist/dashboard" ? TITLES[tab] || "Dashboard" : PAGES[pathname] || "Dashboard";
  return <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7">
    <h1 className="text-[22px] font-extrabold tracking-tight text-[#102f49]">{title}</h1>
    <div className="flex items-center gap-5">
      <label className="hidden h-10 w-[280px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-400 lg:flex"><i className="ti ti-search text-lg" /><input aria-label="Search" placeholder="Search anything..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" /></label>
      <NotificationPopover viewAllHref="/panelist/notifications" compact />
      <Link href="/panelist/profile" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f63] text-xs font-bold text-white">{profile?.initials || "DP"}</span><span className="hidden text-sm font-semibold text-[#102f49] sm:inline">{profile?.name || "Defense Panelist"}</span><i className="ti ti-chevron-down hidden text-sm text-[#173f63] sm:block" /></Link>
    </div>
  </header>;
}
