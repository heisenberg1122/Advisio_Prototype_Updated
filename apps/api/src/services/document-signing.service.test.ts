import { describe, expect, it } from "vitest";
import { legacyDocumentSignatureAccessPolicy } from "./document-signing.service.js";

const context = {
  researchCollegeId: "college-a",
  projectRoles: [] as Array<{ userId: string; projectRole: string }>,
  workflowOwnerId: null,
  hasAcceptedPanelAssignment: false,
  hasLockedPanelEvaluation: false,
  documentType: "MANUSCRIPT",
  deanRecipientId: null,
};

describe("legacy document signature authorization", () => {
  it("requires an actual adviser assignment", () => {
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "a", roles: ["ADVISER"], collegeId: "college-a" },
        context,
      ).canSign,
    ).toBe(false);
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "a", roles: ["ADVISER"], collegeId: "college-a" },
        { ...context, projectRoles: [{ userId: "a", projectRole: "ADVISER" }] },
      ).canSign,
    ).toBe(true);
  });

  it("never grants academic signing authority to a system administrator", () => {
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "admin", roles: ["SYSTEM_ADMIN"], collegeId: null },
        context,
      ).canSign,
    ).toBe(false);
  });

  it("requires a college assignment for RPO and the exact recipient for dean requests", () => {
    const deanContext = {
      ...context,
      documentType: "DEAN_DEFENSE_APPROVAL",
      deanRecipientId: "dean-a",
    };
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "dean-a", roles: ["RPO"], collegeId: null },
        deanContext,
      ).canSign,
    ).toBe(false);
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "dean-b", roles: ["RPO"], collegeId: "college-a" },
        deanContext,
      ).canSign,
    ).toBe(false);
    expect(
      legacyDocumentSignatureAccessPolicy(
        { id: "dean-a", roles: ["RPO"], collegeId: "college-a" },
        deanContext,
      ).canSign,
    ).toBe(true);
  });
});
