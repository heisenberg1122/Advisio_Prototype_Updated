import { describe, expect, it } from "vitest";
import { researchScopeWhere } from "./research-list-scope.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
const user = (roles: string[], extra = {}) => ({ id: "u", roles, collegeId: "college-a", ...extra }) as AuthenticatedUser;
describe("research project picker scope", () => {
  it("lists a dean's college projects without requiring project authorship", () => {
    expect(researchScopeWhere(user(["DEAN"]))).toEqual({ collegeId: "college-a" });
  });
  it("keeps researcher-panel membership limits even for a multi-role dean", () => {
    const where = researchScopeWhere(user(["DEAN", "RESEARCHER"], { researcherPanel: true }));
    expect(where).toMatchObject({ collegeId: "college-a", members: { some: { userId: "u", leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } } });
  });
  it("does not give an unassigned dean institution-wide discovery", () => {
    expect(researchScopeWhere(user(["DEAN"], { collegeId: null }))).toEqual({ createdBy: "u" });
  });
  it("preserves faculty assignments and system administrator discovery", () => {
    expect(researchScopeWhere(user(["ADVISER"]))).toMatchObject({ collegeId: "college-a", OR: [{ members: { some: { userId: "u", projectRole: "ADVISER" } } }] });
    expect(researchScopeWhere(user(["SYSTEM_ADMIN"]))).toEqual({});
  });
});
