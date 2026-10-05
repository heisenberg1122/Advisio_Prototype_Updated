import { describe, expect, it } from "vitest";
import { canAccessCollege, getCollegeScope } from "./college-scope.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

function user(roles: AuthenticatedUser["roles"], collegeId: string | null): AuthenticatedUser {
  return { id: "user-1", email: "user@example.edu", universityId: "UA-1", roles, permissions: [], collegeId };
}

describe("college scope", () => {
  it.each(["SYSTEM_ADMIN", "RPO", "VPAA"] as const)("gives %s institution-wide scope", (role) => {
    expect(getCollegeScope(user([role], "cit"))).toEqual({ kind: "institution", collegeId: null });
    expect(canAccessCollege(user([role], "cit"), "accountancy")).toBe(true);
  });

  it("limits a college role to its assigned college", () => {
    const professor = user(["RESEARCH_COORDINATOR"], "cit");
    expect(canAccessCollege(professor, "cit")).toBe(true);
    expect(canAccessCollege(professor, "accountancy")).toBe(false);
  });

  it("does not grant academic access to an unassigned user", () => {
    const researcher = user(["RESEARCHER"], null);
    expect(getCollegeScope(researcher).kind).toBe("unassigned");
    expect(canAccessCollege(researcher, "cit")).toBe(false);
  });
});
