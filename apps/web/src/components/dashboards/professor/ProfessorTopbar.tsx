"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/layout/AppTopbar";

const TITLES: Record<string, string> = {
  overview: "Professor Dashboard",
  messages: "Messages",
  announcements: "Announcements",
  monitoring: "Research Projects",
  submissions: "Student Submissions",
  defense: "Defense Management",
  builder: "Workflow Builder",
  deployment: "Workflow Deployment",
  locking: "Task Access",
  workflow: "Research Workflow",
  tracking: "Group Progress",
  completion: "Completion Status",
  deadlines: "Deadlines",
  settings: "Settings",
};

const PAGES: Record<string, string> = {
  "/professor/analytics": "Analytics",
  "/professor/milestones": "Milestones",
  "/professor/panelists": "Panelists",
  "/professor/plagiarism": "Plagiarism Checks",
  "/professor/rubric": "Evaluation Rubrics",
  "/professor/profile": "My Profile",
  "/professor/profile/edit": "Edit Profile",
  "/professor/notifications": "Notifications",
  "/professor/settings": "Account Settings",
  "/professor/inbox": "Inbox",
  "/professor/signatures": "Signature Requests",
};

export function ProfessorTopbar() {
  const pathname = usePathname() || "";
  const tab = useSearchParams().get("tab") || "overview";

  const title =
    pathname === "/professor/dashboard"
      ? TITLES[tab] || "Professor Dashboard"
      : PAGES[pathname] || "Professor Dashboard";

  return (
    <AppTopbar
      title={title}
      hideTitle={pathname === "/professor/dashboard" && tab === "overview"}
      subtitle="Faculty Coordinator Workspace"
      notificationsHref="/professor/notifications"
      profileHref="/professor/profile"
      settingsHref="/professor/settings"
      searchPlaceholder="Search researchers, projects, submissions..."
      variant="workspace"
    />
  );
}
