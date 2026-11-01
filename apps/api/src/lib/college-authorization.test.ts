import { describe, expect, it } from "vitest";
import { resolveCollegeAuthorization } from "./college-authorization.js";

const college = (id: string, isActive = true) => ({
  id,
  name: id,
  code: id,
  isActive,
});
const account = {
  collegeId: "a",
  programId: "program-a",
  college: college("a"),
  roles: ["RESEARCHER", "ADVISER", "PANELIST"].map((name) => ({
    role: { name },
  })),
  collegeMemberships: [
    { collegeId: "a", college: college("a"), roleNames: ["ADVISER"] },
    { collegeId: "b", college: college("b"), roleNames: ["PANELIST"] },
  ],
};
describe("college authorization", () => {
  it("uses only the roles approved for the selected college", () => {
    expect(resolveCollegeAuthorization(account).roles).toEqual([
      "RESEARCHER",
      "ADVISER",
    ]);
    expect(resolveCollegeAuthorization(account, "b")).toMatchObject({
      collegeId: "b",
      programId: null,
      roles: ["PANELIST"],
    });
  });
  it("does not turn a global faculty role into an unapproved college grant", () => {
    expect(
      resolveCollegeAuthorization({ ...account, collegeMemberships: [] }).roles,
    ).toEqual(["RESEARCHER"]);
  });
  it("rejects unknown, removed, and inactive college access", () => {
    expect(() => resolveCollegeAuthorization(account, "c")).toThrow(
      "approved access",
    );
    expect(() =>
      resolveCollegeAuthorization(
        {
          ...account,
          collegeMemberships: [
            { ...account.collegeMemberships[1], college: college("b", false) },
          ],
        },
        "b",
      ),
    ).toThrow("approved access");
  });
  it("preserves institution-wide System Admin authority", () => {
    expect(
      resolveCollegeAuthorization({
        ...account,
        roles: [{ role: { name: "SYSTEM_ADMIN" } }],
      }).roles,
    ).toContain("SYSTEM_ADMIN");
  });
  it("keeps an administrator's academic roles scoped to their approved college", () => {
    const administrator = { ...account, roles: [...account.roles, { role: { name: "SYSTEM_ADMIN" } }] };
    expect(resolveCollegeAuthorization(administrator, "b").roles).toEqual(["SYSTEM_ADMIN", "PANELIST"]);
  });
});
