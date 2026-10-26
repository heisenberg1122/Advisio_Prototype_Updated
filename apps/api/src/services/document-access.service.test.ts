import { describe, expect, it } from "vitest";
import { documentProjectAccessPolicy } from "./document-access.service.js";

const user = (roles: string[], collegeId: string | null = "college-a") => ({
  id: "user-a",
  email: "user@example.edu",
  universityId: "UA-1",
  roles: roles as any,
  permissions: [],
  collegeId,
  programId: null,
});

const context = (
  overrides: Partial<Parameters<typeof documentProjectAccessPolicy>[1]> = {},
) => ({
  collegeId: "college-a",
  isProjectCreator: false,
  activeProjectRoles: [],
  isWorkflowOwner: false,
  hasAssignedReview: false,
  ...overrides,
});

describe("documentProjectAccessPolicy", () => {
  it("allows active group members to manage their project workspace", () => {
    const access = documentProjectAccessPolicy(
      user(["RESEARCHER"]),
      context({ activeProjectRoles: ["MEMBER"] }),
    );
    expect(access.canView).toBe(true);
    expect(access.canManageWorkingDocuments).toBe(true);
    expect(access.canSubmitManuscript).toBe(true);
  });

  it("denies unrelated students", () => {
    const access = documentProjectAccessPolicy(user(["RESEARCHER"]), context());
    expect(access.canView).toBe(false);
    expect(access.canManageWorkingDocuments).toBe(false);
    expect(access.canSubmitManuscript).toBe(false);
  });

  it("does not treat a project creator as current membership", () => {
    const access = documentProjectAccessPolicy(
      user(["RESEARCHER"]),
      context({ isProjectCreator: true }),
    );
    expect(access.canView).toBe(false);
    expect(access.canManageWorkingDocuments).toBe(false);
  });

  it("requires an actual adviser assignment", () => {
    expect(
      documentProjectAccessPolicy(user(["ADVISER"]), context()).canReview,
    ).toBe(false);
    expect(
      documentProjectAccessPolicy(
        user(["ADVISER"]),
        context({ activeProjectRoles: ["ADVISER"] }),
      ).canReview,
    ).toBe(true);
    expect(
      documentProjectAccessPolicy(
        user(["ADVISER"]),
        context({ activeProjectRoles: ["ADVISER"] }),
      ).canSubmitManuscript,
    ).toBe(false);
  });

  it("requires the professor to own the assigned workflow", () => {
    expect(
      documentProjectAccessPolicy(user(["RESEARCH_COORDINATOR"]), context())
        .canView,
    ).toBe(false);
    expect(
      documentProjectAccessPolicy(
        user(["RESEARCH_COORDINATOR"]),
        context({ isWorkflowOwner: true }),
      ).canReview,
    ).toBe(true);
  });

  it("limits a college-assigned Dean office user to that college", () => {
    expect(
      documentProjectAccessPolicy(user(["DEAN"], "college-b"), context())
        .canApproveOfficialDocuments,
    ).toBe(false);
    const scoped = documentProjectAccessPolicy(
      user(["DEAN"], "college-a"),
      context(),
    );
    expect(scoped.canApproveOfficialDocuments).toBe(true);
    expect(scoped.canView).toBe(false);
    expect(
      documentProjectAccessPolicy(user(["DEAN"], null), context())
        .canApproveOfficialDocuments,
    ).toBe(false);
  });

  it("does not grant panelists generic project access from role alone", () => {
    const access = documentProjectAccessPolicy(user(["PANELIST"]), context());
    expect(access.canView).toBe(false);
    expect(access.canReview).toBe(false);
  });

  it("keeps explicitly assigned reviewers limited to their exact version scope", () => {
    const access = documentProjectAccessPolicy(
      user(["REB"]),
      context({ hasAssignedReview: true }),
    );
    expect(access.canView).toBe(false);
    expect(access.canReview).toBe(true);
    expect(access.canManageWorkingDocuments).toBe(false);
  });

  it("does not grant administrators document content access from role alone", () => {
    const access = documentProjectAccessPolicy(
      user(["SYSTEM_ADMIN"], null),
      context(),
    );
    expect(access.canView).toBe(false);
    expect(access.canManageWorkingDocuments).toBe(false);
    expect(access.canApproveOfficialDocuments).toBe(false);
  });
});
