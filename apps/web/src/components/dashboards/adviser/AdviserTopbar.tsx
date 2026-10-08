"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/layout/AppTopbar";

const PAGE_TITLES: Record<string, string> = {
  "/adviser/advisees": "My Advisees",
  "/adviser/requests": "Milestone Requests",
  "/adviser/consultations": "Consultations",
  "/adviser/reviews": "Document Reviews",
  "/adviser/tasks": "Tasks",
  "/adviser/announcements": "Announcements",
  "/adviser/profile": "My Profile",
  "/adviser/profile/edit": "Edit Profile",
  "/adviser/notifications": "Notifications",
  "/adviser/settings": "Account Settings",
  "/adviser/inbox": "Inbox",
};

const TAB_TITLES: Record<string, string> = {
  overview: "Adviser Dashboard",
  advisees: "My Advisees",
  reviews: "Document Reviews",
  consultations: "Consultations",
  progress: "Group Progress",
  approvals: "Milestone Approvals",
  history: "Consultation History",
  conferencing: "Video Meetings",
  "group-chats": "Messages",
  chat: "Messages",
  defense: "Defense Schedule",
  settings: "Settings",
};

export function AdviserTopbar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const title =
    pathname === "/adviser/dashboard"
      ? TAB_TITLES[currentTab] || "Adviser Dashboard"
      : PAGE_TITLES[pathname] || "Adviser Dashboard";

  return (
    <AppTopbar
      title={title}
      hideTitle={pathname === "/adviser/dashboard" && currentTab === "overview"}
      subtitle="Faculty Advising Center"
      notificationsHref="/adviser/notifications"
      profileHref="/adviser/profile"
      settingsHref="/adviser/settings"
      searchPlaceholder="Search advisees, manuscripts, requests..."
      variant="workspace"
    />
  );
}
