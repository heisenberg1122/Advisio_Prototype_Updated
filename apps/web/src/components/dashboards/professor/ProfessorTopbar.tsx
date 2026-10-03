"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/layout/AppTopbar";

const TITLES: Record<string, string> = {
  overview: "Professor Dashboard",
  announcements: "Announcements",
  monitoring: "Research Groups",
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
      subtitle="Faculty Coordinator Workspace"
      notificationsHref="/professor/notifications"
      profileHref="/professor/profile"
      searchPlaceholder="Search classes, research groups, submissions..."
      variant="workspace"
    />
  );
}
