"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/layout/AppTopbar";

const PAGE_TITLES: Record<string, string> = {
  "/student/groups": "My Group",
  "/student/join-group": "Join Research Group",
  "/student/adviser-pool": "Adviser Pool",
  "/student/submissions": "Submissions",
  "/student/consultations": "Consultations",
  "/student/defense": "Defense Center",
  "/student/grades": "Grades",
  "/student/notifications": "Notifications",
  "/student/profile": "My Profile",
  "/student/profile/edit": "Edit Profile",
  "/student/settings": "Settings",
  "/student/tasks": "Tasks & Requirements",
  "/student/documents": "Document Workspace",
  "/student/group-files": "Group Files",
};

const TAB_TITLES: Record<string, string> = {
  overview: "Researcher Dashboard",
  group: "My Project",
  milestones: "Project Milestones",
  progress: "Progress Tracking",
  submission: "Submit Document",
  submissions: "Submissions",
  "version-control": "Document Versions",
  workspace: "Document Workspace",
  consultations: "Consultations",
  "consultation-requests": "Consultation Requests",
  "consultation-repo": "Consultation Repository",
  conferencing: "Group Conferencing",
  "group-chats": "Messages",
  defense: "Defense Schedule",
  certificates: "Certificates",
  "adviser-credentials": "Adviser Directory",
  "ai-recommendation": "Adviser Recommendations",
  settings: "Settings",
};

export function StudentTopbar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const title =
    pathname === "/student/dashboard"
      ? TAB_TITLES[currentTab] || "Researcher Dashboard"
      : PAGE_TITLES[pathname] || "Researcher Dashboard";

  return (
    <AppTopbar
      title={title}
      subtitle="University Research Workspace"
      notificationsHref="/student/notifications"
      profileHref="/student/profile"
      searchPlaceholder="Search anything..."
      variant="workspace"
    />
  );
}
