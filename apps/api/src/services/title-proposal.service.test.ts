import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => {
  const db = {
    $executeRaw: vi.fn(),
    researchProject: { findUnique: vi.fn(), update: vi.fn() },
    workflowStage: { findUnique: vi.fn() },
    workflow: { findUnique: vi.fn() },
    titleProposalSubmission: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    notification: { createMany: vi.fn() },
  };
  return { db, enrolled: vi.fn(), advance: vi.fn(), condition: vi.fn() };
});
vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: (fn: any) => fn(state.db) },
}));
vi.mock("./workflow-enrollment-access.service.js", () => ({
  hasActiveWorkflowEnrollment: state.enrolled,
}));
vi.mock("./milestone-condition.service.js", () => ({
  assertMilestoneCondition: state.condition,
}));
vi.mock("./research-workflow-integration.service.js", () => ({
  advanceMilestoneIfSatisfied: state.advance,
}));
import {
  reviewTitleProposals,
  selectedProposalTitle,
  submitTitleProposals,
  validateProposalTitles,
} from "./title-proposal.service.js";
const titles = [
  "First research title",
  "Second research title",
  "Third research title",
];
const project = {
  id: "project",
  title: "Draft project",
  status: "DRAFT",
  registeredAt: null,
  workflowInstance: { workflowId: "workflow", currentStageId: "stage" },
  members: [{ userId: "leader", projectRole: "LEADER" }],
};
const submission = {
  id: "submission",
  researchId: "project",
  stageId: "stage",
  version: 2,
  status: "SUBMITTED",
  titles,
};
beforeEach(() => {
  vi.resetAllMocks();
  state.db.researchProject.findUnique.mockResolvedValue(project);
  state.db.workflowStage.findUnique.mockResolvedValue({
    id: "stage",
    workflowId: "workflow",
    category: "Milestone",
    milestoneType: "TITLE_PROPOSAL",
    titleProposalCount: 3,
  });
  state.enrolled.mockResolvedValue(true);
  state.db.titleProposalSubmission.upsert.mockResolvedValue({
    ...submission,
    version: 3,
  });
  state.db.titleProposalSubmission.findUnique.mockResolvedValue(submission);
  state.db.titleProposalSubmission.update.mockResolvedValue({
    ...submission,
    status: "APPROVED",
    selectedIndex: 0,
  });
});
describe("title proposal validation", () => {
  it("requires the configured count and unique nonempty titles", () => {
    expect(
      validateProposalTitles(
        titles.map((title) => ` ${title} `),
        3,
      ),
    ).toEqual(titles);
    for (const invalid of [
      [],
      ["A", "B", "C"],
      [titles[0], titles[0].toUpperCase(), titles[2]],
      [1, 2, 3],
      null,
    ])
      expect(() => validateProposalTitles(invalid, 3)).toThrow();
  });
  it("accepts only an integer index into the saved titles", () => {
    expect(selectedProposalTitle(titles, 0)).toBe(titles[0]);
    for (const invalid of [-1, 3, 0.5, "0", null])
      expect(() => selectedProposalTitle(titles, invalid)).toThrow();
  });
});
describe("title proposal submission and registration", () => {
  const submit = () =>
    submitTitleProposals({
      researchId: "project",
      stageId: "stage",
      userId: "leader",
      titles,
    });
  const review = (overrides = {}) =>
    reviewTitleProposals({
      researchId: "project",
      stageId: "stage",
      reviewerId: "professor",
      version: 2,
      status: "APPROVED",
      selectedIndex: 0,
      ...overrides,
    });
  it("only lets enrolled leaders submit", async () => {
    state.enrolled.mockResolvedValue(false);
    await expect(submit()).rejects.toMatchObject({ statusCode: 403 });
    expect(state.db.titleProposalSubmission.upsert).not.toHaveBeenCalled();
  });
  it("does not replace a pending or approved submission", async () => {
    await expect(submit()).rejects.toMatchObject({ statusCode: 409 });
    expect(state.db.titleProposalSubmission.upsert).not.toHaveBeenCalled();
  });
  it("allows revised titles and increments the submission version", async () => {
    state.db.titleProposalSubmission.findUnique.mockResolvedValue({
      ...submission,
      status: "REVISION_REQUIRED",
    });
    await submit();
    expect(state.db.titleProposalSubmission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          version: { increment: 1 },
          titles,
          status: "SUBMITTED",
          selectedIndex: null,
        }),
      }),
    );
  });
  it("registers the selected saved title and advances the milestone atomically", async () => {
    await review();
    expect(state.db.researchProject.update).toHaveBeenCalledWith({
      where: { id: "project" },
      data: {
        title: titles[0],
        registeredAt: expect.any(Date),
        workflowDraft: false,
        status: "APPROVED",
      },
    });
    expect(state.advance).toHaveBeenCalledWith(state.db, {
      researchId: "project",
      milestoneId: "stage",
      actorId: "professor",
    });
    expect(state.db.notification.createMany).toHaveBeenCalled();
  });
  it("rejects stale reviews before changing records", async () => {
    await expect(review({ version: 1 })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(state.db.titleProposalSubmission.update).not.toHaveBeenCalled();
  });
  it("prevents self-review", async () => {
    await expect(review({ reviewerId: "leader" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it("requires revision feedback and keeps the project unregistered", async () => {
    await expect(review({ status: "REVISION_REQUIRED" })).rejects.toMatchObject(
      { statusCode: 400 },
    );
    await review({
      status: "REVISION_REQUIRED",
      reviewNote: "Please narrow the topic.",
    });
    expect(state.db.researchProject.update).not.toHaveBeenCalled();
    expect(state.advance).not.toHaveBeenCalled();
    expect(state.db.titleProposalSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REVISION_REQUIRED",
          selectedIndex: null,
        }),
      }),
    );
  });
  it("enforces milestone conditions", async () => {
    state.condition.mockRejectedValue(
      Object.assign(new Error("Required milestone is incomplete"), {
        statusCode: 409,
      }),
    );
    await expect(review()).rejects.toMatchObject({ statusCode: 409 });
    expect(state.db.researchProject.update).not.toHaveBeenCalled();
  });
  it("rejects a stage belonging to a different workflow", async () => {
    state.db.workflowStage.findUnique.mockResolvedValue({
      id: "stage",
      workflowId: "other",
      milestoneType: "TITLE_PROPOSAL",
    });
    await expect(submit()).rejects.toMatchObject({ statusCode: 404 });
  });
});
