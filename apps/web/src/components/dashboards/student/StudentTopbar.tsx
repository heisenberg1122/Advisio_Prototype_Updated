"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/student/groups":       "My Group",
  "/student/adviser-pool": "Adviser Pool",
  "/student/submissions":  "Submissions",
  "/student/consultations":"Consultations",
  "/student/defense":      "Defense Center",
  "/student/grades":       "Grades",
  "/student/notifications":"Notifications",
  "/student/profile":      "My Profile",
  "/student/profile/edit": "Edit Profile",
  "/student/settings":     "Settings",
};

const STUDENT_TAB_TITLES: Record<string, string> = {
  overview: "Student Dashboard",
  group: "Research Group Management",
  milestones: "Project Milestones",
  progress: "Progress Tracking",
  submission: "Research Document Submission",
  "version-control": "Document Version Control",
  "adviser-credentials": "Adviser Credentials Hub",
  "ai-recommendation": "AI Adviser Recommendation",
  "consultation-requests": "Consultation Requests",
  "consultation-repo": "Consultation Repository",
  conferencing: "Group Conferencing",
  "group-chats": "Group Chats",
  defense: "Defense Schedule",
  certificates: "Certificates of Completion",
  settings: "Settings",
  workspace: "Document Workspace (Editor)",
};

export function StudentTopbar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  let title = PAGE_TITLES[pathname] ?? "Student Dashboard";
  if (pathname === "/student/dashboard") {
    title = STUDENT_TAB_TITLES[currentTab] || "Student Dashboard";
  }
  const { unreadCount } = useNotifications();
  const { profile } = useProfile();

  return (
    <header
      className="h-[52px] flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-200 bg-white"
    >
      <span className="text-[13px] font-medium text-slate-800" aria-label="Current page">{title}</span>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/student/notifications"
          className={cn(
            "relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition",
          )}
          aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
        >
          <i className="ti ti-bell text-base" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>
        <Link
          href="/student/profile"
          className="w-8 h-8 rounded-full bg-[#1b4264] text-white flex items-center justify-center text-[11px] font-bold hover:opacity-90 transition flex-shrink-0"
          title="My Profile"
          aria-label="Go to my profile"
        >
          {profile?.initials || "ST"}
        </Link>
      </div>
    </header>
  );
}
