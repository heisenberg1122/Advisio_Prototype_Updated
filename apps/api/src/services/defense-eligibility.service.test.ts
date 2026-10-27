import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ progress: vi.fn(), condition: vi.fn() }));
vi.mock("./research-workflow-integration.service.js", () => ({
  getMilestoneProgress: mocks.progress,
}));
vi.mock("./milestone-condition.service.js", () => ({
  assertMilestoneCondition: mocks.condition,
}));
import {
  approveDefenseEligibility,
  currentDefenseEligibility,
  requireDefenseEligibility,
  consumeDefenseEligibility,
  getDefenseReadiness,
} from "./defense-eligibility.service.js";

const gate = (id: string, sequence: number, completed = true) => ({
  id,
  name: id,
  sequence,
  milestoneType: "DEFENSE_ELIGIBILITY",
  completed,
  tasks: [],
  requiresDocument: false,
});
const grant = (milestoneId: string, consumedAt: Date | null = null) => ({
  id: `grant-${milestoneId}`,
  researchId: "group",
  milestoneId,
  consumedAt,
  deanApprovalDocumentId: "letter",
});

describe("defense eligibility cycles", () => {
  let db: any;
  beforeEach(() => {
    vi.resetAllMocks();
    db = {
      $executeRaw: vi.fn(),
      defenseEligibility: {
        findMany: vi.fn().mockResolvedValue([grant("title")]),
        upsert: vi.fn().mockResolvedValue(grant("title")),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      defenseSession: { findFirst: vi.fn().mockResolvedValue(null) },
      document: { findFirst: vi.fn().mockResolvedValue({ id: "letter" }) },
    };
    mocks.progress.mockResolvedValue([
      gate("title", 1),
      gate("final", 2, false),
    ]);
  });

  it("does not grant defense eligibility from adviser acceptance or workflow completion", async () => {
    mocks.progress.mockResolvedValue([
      { id: "adviser", completed: true, milestoneType: "ADVISER_SELECTION" },
    ]);
    expect(await currentDefenseEligibility(db, "group")).toBeNull();
  });
  it("returns only the approved, unconsumed milestone for that group", async () => {
    expect(await currentDefenseEligibility(db, "group")).toMatchObject({
      milestoneId: "title",
    });
    expect(db.defenseEligibility.findMany).toHaveBeenCalledWith({
      where: { researchId: "group" },
    });
  });
  it("checks Title Defense readiness while Final Defense is still incomplete", async () => {
    expect(await getDefenseReadiness(db, "group")).toEqual({
      workflowApproved: true,
      deanApprovalSigned: true,
    });
  });
  it("checks the workflow gate while the Dean signature is still pending", async () => {
    db.document.findFirst.mockResolvedValue(null);
    expect(await getDefenseReadiness(db, "group")).toEqual({
      workflowApproved: true,
      deanApprovalSigned: false,
    });
  });
  it("does not reuse the passed cycle's approval or signature for the next defense", async () => {
    db.defenseEligibility.findMany.mockResolvedValue([grant("title", new Date())]);
    expect(await getDefenseReadiness(db, "group")).toEqual({
      workflowApproved: false,
      deanApprovalSigned: false,
    });
    expect(db.document.findFirst).not.toHaveBeenCalled();
  });
  it("cannot reuse Title Defense approval after the group passes", async () => {
    db.defenseEligibility.findMany.mockResolvedValue([
      grant("title", new Date()),
    ]);
    expect(await currentDefenseEligibility(db, "group")).toBeNull();
    await expect(requireDefenseEligibility(db, "group")).rejects.toThrow(
      "unconsumed",
    );
  });
  it("requires a new Final Defense approval and a new Dean letter", async () => {
    mocks.progress.mockResolvedValue([gate("title", 1), gate("final", 2)]);
    db.defenseEligibility.findMany.mockResolvedValue([
      grant("title", new Date()),
      { ...grant("final"), deanApprovalDocumentId: null },
    ]);
    await expect(requireDefenseEligibility(db, "group")).rejects.toThrow(
      "signed Dean approval",
    );
    expect(db.document.findFirst).not.toHaveBeenCalled();
    expect(await requireDefenseEligibility(db, "group", false)).toMatchObject({
      milestoneId: "final",
    });
  });
  it("does not skip an unapproved earlier defense gate", async () => {
    mocks.progress.mockResolvedValue([
      gate("title", 1, false),
      gate("final", 2),
    ]);
    db.defenseEligibility.findMany.mockResolvedValue([grant("final")]);
    expect(await currentDefenseEligibility(db, "group")).toBeNull();
  });
  it("blocks duplicate active sessions", async () => {
    db.defenseSession.findFirst.mockResolvedValue({ id: "existing" });
    await expect(requireDefenseEligibility(db, "group")).rejects.toThrow(
      "active defense",
    );
  });
  it("checks that the exact cycle's Dean letter has an active unrevoked signature", async () => {
    db.document.findFirst.mockResolvedValue(null);
    await expect(requireDefenseEligibility(db, "group")).rejects.toThrow(
      "signed Dean approval",
    );
    expect(db.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "letter",
          documentType: "DEAN_DEFENSE_APPROVAL",
          versions: expect.objectContaining({
            some: expect.objectContaining({
              status: "ACTIVE",
              signedSignature: expect.objectContaining({
                is: expect.objectContaining({ revokedAt: null }),
              }),
            }),
          }),
        }),
      }),
    );
  });
  it("consumes only the session's linked eligibility when the result is Approved", async () => {
    const now = new Date();
    await consumeDefenseEligibility(
      db,
      { id: "session", researchId: "group", eligibilityId: "grant-title" },
      "APPROVED",
      now,
    );
    expect(db.defenseEligibility.updateMany).toHaveBeenCalledWith({
      where: { id: "grant-title", researchId: "group", consumedAt: null },
      data: { consumedAt: now },
    });
  });
  it.each([
    "REJECTED",
    "MAJOR_REVISIONS_REQUIRED",
    "APPROVED_WITH_MINOR_REVISIONS",
  ])("preserves the cycle while the result is %s", async (decision) => {
    await consumeDefenseEligibility(
      db,
      { id: "session", researchId: "group", eligibilityId: "grant-title" },
      decision,
      new Date(),
    );
    expect(db.defenseEligibility.updateMany).not.toHaveBeenCalled();
  });
  it("refuses to reset a consumed milestone's approval", async () => {
    db.defenseEligibility.upsert.mockResolvedValue(grant("title", new Date()));
    await expect(
      approveDefenseEligibility(db, {
        researchId: "group",
        milestoneId: "title",
        actorId: "professor",
      }),
    ).rejects.toThrow("already consumed");
    expect(db.defenseEligibility.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
  it("does not approve Final Defense until the prior defense cycle has passed", async () => {
    db.defenseEligibility.findMany.mockResolvedValue([]);
    await expect(
      approveDefenseEligibility(db, {
        researchId: "group",
        milestoneId: "final",
        actorId: "professor",
      }),
    ).rejects.toThrow("preceding defense");
    expect(db.defenseEligibility.upsert).not.toHaveBeenCalled();
  });
  it("checks prerequisites and required submissions before coordinator approval", async () => {
    mocks.progress.mockResolvedValue([
      {
        ...gate("title", 1, false),
        requiresDocument: true,
        documentRequirementSatisfied: false,
      },
    ]);
    await expect(
      approveDefenseEligibility(db, {
        researchId: "group",
        milestoneId: "title",
        actorId: "professor",
      }),
    ).rejects.toThrow("required submissions");
    expect(mocks.condition).toHaveBeenCalledWith(db, "group", "title");
    expect(db.defenseEligibility.upsert).not.toHaveBeenCalled();
  });
});
