import type { Request, Response } from "express";
import type { AuthenticatedUser } from "../middleware/auth.js";

export const INSTITUTION_WIDE_ROLES = new Set(["SYSTEM_ADMIN", "RPO", "VPAA"]);

export type CollegeScope =
  | { kind: "institution"; collegeId: null }
  | { kind: "college"; collegeId: string }
  | { kind: "unassigned"; collegeId: null };

export function getCollegeScope(user: AuthenticatedUser): CollegeScope {
  if (user.roles.some((role) => INSTITUTION_WIDE_ROLES.has(role))) {
    return { kind: "institution", collegeId: null };
  }
  if (user.collegeId) return { kind: "college", collegeId: user.collegeId };
  return { kind: "unassigned", collegeId: null };
}

export function canAccessCollege(user: AuthenticatedUser, collegeId: string | null | undefined): boolean {
  const scope = getCollegeScope(user);
  return scope.kind === "institution" || (scope.kind === "college" && scope.collegeId === collegeId);
}

export function requireAssignedCollege(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const scope = getCollegeScope(req.user);
  if (scope.kind === "unassigned") {
    res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
    return null;
  }
  return scope.collegeId;
}
