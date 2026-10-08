"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/layout/AppTopbar";

const TITLES: Record<string, string> = {
  overview: "Panelist Dashboard",
  messages: "Messages",
  schedule: "Defense Schedule",
  documents: "Research Documents",
  evaluation: "Evaluations & Scoring",
  evaluations: "Evaluations & Scoring",
  grades: "Results & Recommendations",
  history: "Evaluation History",
  settings: "Settings",
};

const PAGES: Record<string, string> = {
  "/panelist/schedule": "Defense Schedule",
  "/panelist/evaluations": "Research Documents",
  "/panelist/scoring": "Evaluation & Scoring",
  "/panelist/profile": "My Profile",
  "/panelist/profile/edit": "Edit Profile",
  "/panelist/notifications": "Notifications",
  "/panelist/settings": "Account Settings",
  "/panelist/inbox": "Inbox",
};

export function PanelistTopbar() {
  const pathname = usePathname() || "";
  const tab = useSearchParams().get("tab") || "overview";
  const title =
    pathname === "/panelist/dashboard"
      ? TITLES[tab] || "Panelist Dashboard"
      : PAGES[pathname] || "Panelist Dashboard";

  return (
    <AppTopbar
      title={title}
      hideTitle={pathname === "/panelist/dashboard" && tab === "overview"}
      subtitle="Oral Defense Center"
      notificationsHref="/panelist/notifications"
      profileHref="/panelist/profile"
      settingsHref="/panelist/settings"
      searchPlaceholder="Search manuscripts, candidates, defenses..."
      variant="workspace"
    />
  );
}
