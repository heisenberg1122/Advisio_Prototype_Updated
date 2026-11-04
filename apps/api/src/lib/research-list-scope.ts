import type { AuthenticatedUser } from "../middleware/auth.js";
import { getCollegeScope } from "./college-scope.js";

export function researchScopeWhere(user: AuthenticatedUser) {
  const scope = getCollegeScope(user);
  const collegeWhere = scope.kind === "college" ? { collegeId: scope.collegeId } : {};
  if (user.researcherPanel) return {
    ...collegeWhere,
    members: { some: { userId: user.id, leftAt: null, projectRole: { in: ["LEADER" as const, "MEMBER" as const] } } },
  };
  // College deans already have archive access; the project picker must use the same college scope.
  if (scope.kind === "institution" || user.roles.includes("RESEARCH_COORDINATOR") || (scope.kind === "college" && user.roles.includes("DEAN"))) return collegeWhere;
  const access: any[] = [];
  if (user.roles.includes("RESEARCHER")) access.push({ members: { some: { userId: user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } } });
  if (user.roles.includes("ADVISER")) access.push({ members: { some: { userId: user.id, leftAt: null, projectRole: "ADVISER" } } });
  if (user.roles.includes("PANELIST")) access.push({ OR: [
    { members: { some: { userId: user.id, leftAt: null, projectRole: "PANELIST" } } },
    { defenseSessions: { some: { invitations: { some: { inviteeId: user.id, status: { not: "REMOVED" } } } } } },
  ] });
  return { ...collegeWhere, ...(access.length ? { OR: access } : { createdBy: user.id }) };
}
