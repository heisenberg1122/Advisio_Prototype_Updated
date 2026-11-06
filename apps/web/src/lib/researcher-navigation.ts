export const WORKSPACE_SECTIONS = [
  { id: "overview", label: "Overview", sidebarLabel: "Project Overview", href: "/student/dashboard?tab=group" },
  { id: "group", label: "Group", sidebarLabel: "Group & Members", href: "/student/dashboard?tab=group&section=my-group" },
  { id: "tasks", label: "Tasks", sidebarLabel: "Tasks & Requirements", href: "/student/tasks" },
  { id: "documents", label: "Documents", sidebarLabel: "Documents & Group Files", href: "/student/documents" },
  { id: "timeline", label: "Timeline", sidebarLabel: "Research Timeline", href: "/student/dashboard?tab=milestones" },
] as const;

export function researcherDestination(pathname: string, params: URLSearchParams) {
  const path = pathname.replace(/\/$/, "");
  const tab = params.get("tab") || "overview";
  if (path === "/student/dashboard" || path === "/dashboard") {
    switch (tab) {
      case "overview": return "home";
      case "group": return params.get("section") === "my-group" ? "group" : "overview";
      case "my-group": return "group";
      case "milestones":
      case "progress": return "timeline";
      case "workspace":
      case "documents":
      case "submission":
      case "submissions":
      case "version-control": return "documents";
      case "defense":
      case "certificates": return "defense";
      case "consultations":
      case "consultation-repo":
      case "consultation-requests":
      case "conferencing":
      case "history": return "consultations";
      case "chat":
      case "group-chats": return "messages";
      case "notifications": return "notifications";
    }
  }
  if (path.startsWith("/student/tasks/")) return "tasks";
  if (path.startsWith("/student/defense/")) return "defense";
  switch (path) {
    case "/student/groups":
    case "/student/join-group": return "group";
    case "/student/tasks": return "tasks";
    case "/student/documents":
    case "/student/group-files": return "documents";
    case "/student/defense": return "defense";
    case "/student/grades": return "grades";
    case "/student/consultations": return "consultations";
    case "/student/calendar": return "calendar";
    case "/student/inbox": return "inbox";
    case "/student/notifications": return "notifications";
    default: return null;
  }
}
