import {
  type DashboardWorkspace,
  type DashboardWorkspaceId,
  getEligibleWorkspaces,
  getDefaultWorkspace,
  getCanonicalAdminUrl,
} from "@research-management/auth";

export function getRoleBadgeLabel(workspace: DashboardWorkspace | null): string {
  if (!workspace) return "INSTITUTIONAL USER";
  switch (workspace.id) {
    case "researcher":
      return "RESEARCHER";
    case "adviser":
      return "ADVISER";
    case "panelist":
      return "PANELIST";
    case "coordinator":
      return "PROFESSOR COORDINATOR";
    case "dean":
      return "DEAN'S OFFICE";
    case "ethics":
      return "ETHICS BOARD";
    case "academic-affairs":
      return "ACADEMIC AFFAIRS";
    case "system-admin":
      return "SYSTEM ADMINISTRATION";
    default:
      return workspace.label.toUpperCase();
  }
}

export function getRolePortalBadge(workspace: DashboardWorkspace | null): string {
  if (!workspace) return "ADVISIO PORTAL";
  switch (workspace.id) {
    case "researcher":
      return "STUDENT RESEARCHER PORTAL";
    case "adviser":
      return "FACULTY ADVISER PORTAL";
    case "panelist":
      return "DEFENSE PANELIST PORTAL";
    case "coordinator":
      return "RESEARCH COORDINATOR PORTAL";
    case "dean":
      return "DEAN / RPO PORTAL";
    case "ethics":
      return "REB ETHICS PORTAL";
    case "academic-affairs":
      return "VPAA PORTAL";
    case "system-admin":
      return "SYSTEM ADMIN PORTAL";
    default:
      return `${workspace.label.toUpperCase()} PORTAL`;
  }
}

export function getRoleTitle(workspace: DashboardWorkspace | null): string {
  if (!workspace) return "Academic Portal";
  switch (workspace.id) {
    case "researcher":
      return "Student Researcher";
    case "adviser":
      return "Faculty Adviser";
    case "panelist":
      return "Defense Panelist";
    case "coordinator":
      return "Professor Coordinator";
    case "dean":
      return "Dean / RPO Office";
    case "ethics":
      return "Research Ethics Board";
    case "academic-affairs":
      return "Office of the VPAA";
    case "system-admin":
      return "System Administration";
    default:
      return workspace.label;
  }
}

export function resolveFallbackDestination(
  userRoles: string[],
  rememberedWorkspaceId?: string | null
): string {
  const eligible = getEligibleWorkspaces(userRoles);
  if (eligible.length === 0) {
    return "/choose-dashboard?state=no-role";
  }
  const defaultWs = getDefaultWorkspace(eligible, rememberedWorkspaceId) || eligible[0];
  return defaultWs.homeUrl;
}

export function formatAdminLink(
  href: string,
  workspaceId: string | null | undefined
): string {
  if (!href.startsWith("/admin")) return href;
  if (!workspaceId) return href;

  // If href already has a workspace query param, preserve it
  if (href.includes("workspace=")) return href;

  const [base, query] = href.split("?");
  const params = new URLSearchParams(query || "");
  params.set("workspace", workspaceId);
  return `${base}?${params.toString()}`;
}
