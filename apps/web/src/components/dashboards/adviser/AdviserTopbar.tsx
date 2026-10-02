"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { useProfile } from "@/hooks/use-profile";

const PAGE_TITLES: Record<string, string> = {
  "/adviser/advisees": "My Advisees", "/adviser/requests": "Milestone Requests", "/adviser/consultations": "Consultations",
  "/adviser/reviews": "Document Reviews", "/adviser/tasks": "Tasks", "/adviser/announcements": "Announcements",
  "/adviser/profile": "My Profile", "/adviser/profile/edit": "Edit Profile", "/adviser/notifications": "Notifications",
};

const TAB_TITLES: Record<string, string> = {
  overview: "Dashboard", advisees: "My Advisees", reviews: "Document Reviews", consultations: "Consultations",
  progress: "Group Progress", approvals: "Milestone Approvals", history: "Consultation History", conferencing: "Video Meetings",
  "group-chats": "Messages", chat: "Messages", defense: "Defense Schedule", settings: "Settings",
};

export function AdviserTopbar() {
  const pathname = usePathname() || "";
  const currentTab = useSearchParams().get("tab") || "overview";
  const { profile } = useProfile();
  const title = pathname === "/adviser/dashboard" ? TAB_TITLES[currentTab] || "Dashboard" : PAGE_TITLES[pathname] || "Dashboard";

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#102f49]">{title}</h1>
      <div className="flex items-center gap-5">
        <label className="hidden h-10 w-[280px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-400 lg:flex">
          <i className="ti ti-search text-lg" />
          <input aria-label="Search" placeholder="Search anything..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
        </label>
        <NotificationPopover viewAllHref="/adviser/notifications" compact />
        <Link href="/adviser/profile" className="flex items-center gap-3" aria-label="Go to profile">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f63] text-xs font-bold text-white">{profile?.initials || "FA"}</span>
          <span className="hidden text-sm font-semibold text-[#102f49] sm:inline">{profile?.name || "Faculty Adviser"}</span>
          <i className="ti ti-chevron-down hidden text-sm text-[#173f63] sm:block" />
        </Link>
      </div>
    </header>
  );
}
