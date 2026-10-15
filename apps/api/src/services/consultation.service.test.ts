import { describe, expect, it } from "vitest";
import { consultationAccessPolicy, legacyConsultationImportKey } from "./consultation.service.js";

const user = (roles: string[]) => ({
  id: "user-a",
  email: "user-a@example.edu",
  universityId: "UA-1",
  roles: roles as any,
  permissions: [],
  collegeId: null,
  programId: null,
});

const context = (overrides: Record<string, unknown> = {}) => ({
  exists: true,
  isProjectCreator: false,
  isWorkflowOwner: false,
  activeProjectRoles: [] as string[],
  ...overrides,
});

describe("consultationAccessPolicy", () => {
  it("denies unrelated users even when their institutional role is faculty", () => {
    expect(consultationAccessPolicy(user(["ADVISER"]), context()).canView).toBe(false);
    expect(consultationAccessPolicy(user(["RESEARCH_COORDINATOR"]), context()).canApprove).toBe(false);
  });

  it("does not substitute project ownership for active membership", () => {
    const access = consultationAccessPolicy(
      user(["RESEARCHER"]),
      context({ isProjectCreator: true }),
    );
    expect(access.canView).toBe(false);
    expect(access.canRequest).toBe(false);
  });

  it("allows active project members to view and request consultations", () => {
    const access = consultationAccessPolicy(
      user(["RESEARCHER"]),
      context({ activeProjectRoles: ["MEMBER"] }),
    );
    expect(access.canView).toBe(true);
    expect(access.canRequest).toBe(true);
    expect(access.canApprove).toBe(false);
  });

  it("requires an assigned adviser, coordinator, or workflow owner to approve", () => {
    expect(
      consultationAccessPolicy(
        user(["ADVISER"]),
        context({ activeProjectRoles: ["ADVISER"] }),
      ).canApprove,
    ).toBe(true);
    expect(
      consultationAccessPolicy(
        user(["RESEARCH_COORDINATOR"]),
        context({ isWorkflowOwner: true }),
      ).canApprove,
    ).toBe(true);
  });

  it("does not grant access to a missing project", () => {
    const access = consultationAccessPolicy(
      user(["SYSTEM_ADMIN"]),
      context({ exists: false }),
    );
    expect(access.canView).toBe(false);
    expect(access.canApprove).toBe(false);
  });

  it("keeps administrators read-only unless they have an academic assignment", () => {
    const access = consultationAccessPolicy(user(["SYSTEM_ADMIN"]), context());
    expect(access.canView).toBe(true);
    expect(access.canRequest).toBe(false);
    expect(access.canApprove).toBe(false);
  });
});

describe("legacyConsultationImportKey", () => {
  it("is stable for retries and isolated by project", () => {
    const first = legacyConsultationImportKey({ userId: "u", researchId: "a", clientId: "legacy-1" });
    const retry = legacyConsultationImportKey({ userId: "u", researchId: "a", clientId: "legacy-1" });
    const otherProject = legacyConsultationImportKey({ userId: "u", researchId: "b", clientId: "legacy-1" });
    expect(first).toBe(retry);
    expect(first).not.toBe(otherProject);
  });
});
