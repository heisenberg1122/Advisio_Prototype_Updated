"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/providers/auth-provider";
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

const PAGE_TITLES: Record<string, string> = {
  "/panelist/schedule":     "Defense Sessions Schedule",
  "/panelist/evaluations":  "Submitted Capstone Documents",
  "/panelist/scoring":      "Digital Evaluation & Scoring",
  "/panelist/profile":      "My Profile",
  "/panelist/profile/edit": "Edit Profile",
  "/panelist/notifications":"Notifications",
};

const PANELIST_TAB_TITLES: Record<string, string> = {
  overview: "Panelist Dashboard",
  schedule: "Defense Schedule Management",
  documents: "Submitted Research Documents",
  evaluation: "Digital Evaluation & Scoring Sheets",
  grades: "Grades & Recommendations",
  history: "Historical Grading Records",
  settings: "Settings",
};

export function PanelistTopbar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  let title = PAGE_TITLES[pathname] ?? "Panelist Dashboard";
  if (pathname === "/panelist/dashboard") {
    title = PANELIST_TAB_TITLES[currentTab] || "Panelist Dashboard";
  }
  const { unreadCount } = useNotifications();
  const { profile } = useProfile();
  const { logout } = useAuth();

  return (
    <header className="h-[52px] flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
      <span className="text-[13px] font-medium text-slate-800" aria-label="Current page">{title}</span>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/panelist/notifications"
          className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
          aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
        >
          <i className="ti ti-bell text-base" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>
        <Link
          href="/panelist/profile"
          className="w-8 h-8 rounded-full bg-[#1b4264] text-white flex items-center justify-center text-[11px] font-bold hover:opacity-90 transition flex-shrink-0"
          title="My Profile"
          aria-label="Go to my profile"
        >
          {profile?.initials || "LW"}
        </Link>

        {/* Permanent Topbar Logout Button */}
        <button
          onClick={() => logout()}
          title="Sign Out"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-red-200 transition text-[12px] font-bold cursor-pointer shrink-0 ml-1"
          aria-label="Sign out of your account"
        >
          <i className="ti ti-logout text-sm" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
