"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import { useProfile } from "@/hooks/use-profile";

const PAGE_TITLES: Record<string, string> = {
  "/student/groups": "My Group", "/student/adviser-pool": "Adviser Pool", "/student/submissions": "Submissions",
  "/student/consultations": "Consultations", "/student/defense": "Defense Center", "/student/grades": "Grades",
  "/student/notifications": "Notifications", "/student/profile": "My Profile", "/student/profile/edit": "Edit Profile",
  "/student/settings": "Settings",
  "/student/tasks": "Tasks & Requirements",
};

const TAB_TITLES: Record<string, string> = {
  overview: "Researcher Dashboard", group: "My Project", milestones: "Project Milestones", progress: "Progress Tracking",
  submission: "Submit Document", submissions: "Submissions", "version-control": "Document Versions", workspace: "Document Workspace",
  consultations: "Consultations", "consultation-requests": "Consultation Requests", "consultation-repo": "Consultation Repository",
  conferencing: "Group Conferencing", "group-chats": "Messages", defense: "Defense Schedule", certificates: "Certificates",
  "adviser-credentials": "Adviser Directory", "ai-recommendation": "Adviser Recommendations", settings: "Settings",
};

export function StudentTopbar() {
  const pathname = usePathname() || "";
  const currentTab = useSearchParams().get("tab") || "overview";
  const { profile } = useProfile();
  const title = pathname === "/student/dashboard" ? TAB_TITLES[currentTab] || "Researcher Dashboard" : PAGE_TITLES[pathname] || "Researcher Dashboard";
  const profileName = profile?.name || "";

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#102f49]">{title}</h1>
      <div className="flex items-center gap-5">
        <label className="hidden h-10 w-[280px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-400 lg:flex">
          <i className="ti ti-search text-lg" />
          <input aria-label="Search" placeholder="Search anything..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
        </label>
        <NotificationPopover viewAllHref="/student/notifications" compact />
        <Link href="/student/profile" className="flex items-center gap-3" aria-label="Go to profile">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f63] text-xs font-bold text-white">{profile?.initials || "SU"}</span>
          <span className="hidden text-sm font-semibold text-[#102f49] sm:inline">{profileName || "Student01"}</span>
          <i className="ti ti-chevron-down hidden text-sm text-[#173f63] sm:block" />
        </Link>
      </div>
    </header>
  );
}
