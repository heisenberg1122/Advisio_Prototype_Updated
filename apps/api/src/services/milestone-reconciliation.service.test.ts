import { describe, expect, it, vi } from "vitest";
import {
  getMilestoneProgress,
  reconcileMilestoneProgress,
} from "./research-workflow-integration.service.js";

function fixture(status = "APPROVED", proposalStatus = "APPROVED") {
  const stage = (
    id: string,
    sequence: number,
    requiredMilestoneId: string | null = null,
  ) => ({
    id,
    name: id,
    sequence,
    requiredMilestoneId,
    milestoneType: id === "title" ? "TITLE_PROPOSAL" : "SUBMISSION",
    requiresDocument: id !== "title",
    requiresApproval: true,
    tasks: [],
    submittedVersions: [],
  });
  const instance = {
    id: "instance",
    currentStageId: "title",
    completedAt: new Date(),
    workflow: {
      name: "Research",
      stages: [
        stage("title", 1),
        stage("chapter1", 2, "title"),
        stage("chapter2", 3, "chapter1"),
      ],
    },
    research: { workflowDraft: false },
  };
  const project = {
    status,
    members: [],
    adviserRequests: [],
    defenseEligibilities: [],
    titleProposals: [{ stageId: "title", status: proposalStatus }],
    workflowInstance: instance,
  };
  const db = {
    $executeRaw: vi.fn(),
    researchProject: {
      findUnique: vi.fn(async () => project),
      update: vi.fn(),
    },
    workflowInstance: {
      findUnique: vi.fn(async () => instance),
      update: vi.fn(async ({ data }) => Object.assign(instance, data)),
    },
    workflowTransition: { create: vi.fn() },
  };
  return { db, instance, project };
}

const options = { researchId: "project", actorId: "professor" };
describe("milestones added after title approval", () => {
  it("advances an approved title to Chapter 1 and leaves Chapter 2 blocked", async () => {
    const { db, instance } = fixture();
    await reconcileMilestoneProgress(db as any, options);
    expect(instance.currentStageId).toBe("chapter1");
    expect(instance.completedAt).toBeNull();
    expect(db.workflowTransition.create).toHaveBeenCalledExactlyOnceWith({
      data: {
        workflowInstanceId: "instance",
        fromStageId: "title",
        toStageId: "chapter1",
        performedBy: "professor",
        remarks: "All mandatory requirements for title were satisfied.",
      },
    });
    const progress = await getMilestoneProgress(db as any, "project");
    expect(progress.find((stage) => stage.id === "chapter1")).toMatchObject({
      isCurrent: true,
      isBlocked: false,
    });
    expect(progress.find((stage) => stage.id === "chapter2")).toMatchObject({
      isCurrent: false,
      isBlocked: true,
    });
    await reconcileMilestoneProgress(db as any, options);
    expect(db.workflowTransition.create).toHaveBeenCalledTimes(1);
  });

  it("reopens a completed project when the workflow gains an unfinished milestone", async () => {
    const { db } = fixture("COMPLETED");
    await reconcileMilestoneProgress(db as any, options);
    expect(db.researchProject.update).toHaveBeenCalledWith({
      where: { id: "project" },
      data: { status: "APPROVED", completedAt: null },
    });
  });

  it.each(["SUBMITTED", "REVISION_REQUIRED"])(
    "keeps Chapter 1 locked for a %s title",
    async (proposalStatus) => {
      const { db, instance } = fixture("APPROVED", proposalStatus);
      await reconcileMilestoneProgress(db as any, options);
      expect(instance.currentStageId).toBe("title");
      expect(db.workflowInstance.update).not.toHaveBeenCalled();
    },
  );

  it("does not reopen archived projects", async () => {
    const { db } = fixture("ARCHIVED");
    await reconcileMilestoneProgress(db as any, options);
    expect(db.workflowInstance.update).not.toHaveBeenCalled();
  });

  it("does not skip an unsatisfied prerequisite of an approved title", async () => {
    const { db, instance } = fixture();
    const title = instance.workflow.stages[0];
    title.requiredMilestoneId = "adviser";
    instance.workflow.stages.unshift({
      ...title,
      id: "adviser",
      name: "Adviser",
      sequence: 0,
      requiredMilestoneId: null,
      milestoneType: "ADVISER_SELECTION",
      requiresDocument: false,
    });
    await reconcileMilestoneProgress(db as any, options);
    expect(db.workflowInstance.update).not.toHaveBeenCalled();
  });

  it("leaves completion intact when no new milestones exist", async () => {
    const { db, instance } = fixture("COMPLETED");
    instance.workflow.stages.splice(1);
    await reconcileMilestoneProgress(db as any, options);
    expect(db.workflowInstance.update).not.toHaveBeenCalled();
    expect(db.researchProject.update).not.toHaveBeenCalled();
  });
});
