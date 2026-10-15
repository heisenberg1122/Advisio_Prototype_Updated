import { describe, expect, it } from "vitest";
import {
  evaluateDefenseManuscriptEligibility,
  hasDefenseFacilitatorAccess,
  panelistPacketAccessPolicy,
  validateDefensePacketMutation,
} from "./defense-manuscript.service.js";

describe("defense facilitator authorization", () => {
  it("requires an academic facilitator role and an assigned college", () => {
    expect(
      hasDefenseFacilitatorAccess({
        roles: ["RESEARCH_COORDINATOR"],
        collegeId: "college-a",
      }),
    ).toBe(true);
    expect(
      hasDefenseFacilitatorAccess({ roles: ["RPO"], collegeId: null }),
    ).toBe(false);
    expect(
      hasDefenseFacilitatorAccess({
        roles: ["SYSTEM_ADMIN"],
        collegeId: "college-a",
      }),
    ).toBe(false);
  });
});

const ready = {
  projectMatches: true,
  isImmutable: true,
  isPdf: true,
  hasChecksum: true,
  isSubmittedSnapshot: true,
  versionApproved: true,
  isCurrentVersion: true,
  documentApproved: true,
  milestoneMatchesWorkflow: true,
  hasRequiredReviewers: true,
  requiredReviewsApproved: true,
  institutionalApprovalSatisfied: true,
  hasAcceptedPanelist: true,
  requiredPanelistsAccepted: true,
  sessionOpen: true,
};

describe("defense manuscript eligibility", () => {
  it("accepts only a fully approved exact immutable version", () => {
    expect(evaluateDefenseManuscriptEligibility(ready)).toMatchObject({
      eligible: true,
      reasons: [],
    });
  });

  it.each([
    ["projectMatches", "does not belong"],
    ["isImmutable", "not an immutable"],
    ["requiredReviewsApproved", "Every mandatory faculty reviewer"],
    ["institutionalApprovalSatisfied", "institutional defense approval"],
    ["requiredPanelistsAccepted", "Every required panelist"],
  ] as const)("rejects failed %s checks", (key, message) => {
    const result = evaluateDefenseManuscriptEligibility({
      ...ready,
      [key]: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain(message);
  });
});

describe("panelist packet access", () => {
  it("requires a published packet and a currently accepted panel role", () => {
    expect(
      panelistPacketAccessPolicy({
        packetPublished: true,
        invitationStatus: "ACCEPTED",
        invitationRole: "PANELIST",
      }),
    ).toBe(true);
  });

  it.each(["PENDING", "DECLINED", "REMOVED", "RECONFIRMATION_REQUIRED"])(
    "denies a %s invitation",
    (invitationStatus) => {
      expect(
        panelistPacketAccessPolicy({
          packetPublished: true,
          invitationStatus,
          invitationRole: "PANEL_CHAIR",
        }),
      ).toBe(false);
    },
  );

  it("denies accepted observers and unpublished packets", () => {
    expect(
      panelistPacketAccessPolicy({
        packetPublished: true,
        invitationStatus: "ACCEPTED",
        invitationRole: "OBSERVER",
      }),
    ).toBe(false);
    expect(
      panelistPacketAccessPolicy({
        packetPublished: false,
        invitationStatus: "ACCEPTED",
        invitationRole: "PANELIST",
      }),
    ).toBe(false);
  });
});

describe("published packet immutability", () => {
  it("blocks ordinary edits after publication", () => {
    expect(() =>
      validateDefensePacketMutation({
        existingStatus: "PUBLISHED",
        existingMappingVersion: 3,
        publish: false,
        replacePublished: false,
      }),
    ).toThrowError(/already published/i);
  });

  it("rejects a stale concurrent replacement", () => {
    expect(() =>
      validateDefensePacketMutation({
        existingStatus: "PUBLISHED",
        existingMappingVersion: 4,
        publish: true,
        replacePublished: true,
        expectedMappingVersion: 3,
        publicationReason: "Correct the approved manuscript attachment.",
      }),
    ).toThrowError(/changed after you opened/i);
  });

  it("permits an explicit reasoned replacement at the expected revision", () => {
    expect(
      validateDefensePacketMutation({
        existingStatus: "PUBLISHED",
        existingMappingVersion: 4,
        publish: true,
        replacePublished: true,
        expectedMappingVersion: 4,
        publicationReason: "Correct the approved manuscript attachment.",
      }),
    ).toEqual({ replacement: true });
  });
});
