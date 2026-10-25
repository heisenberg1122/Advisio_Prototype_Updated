import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  workflowEnrollment: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: db }));
import {
  filterResearchWorkflowDetails,
  hasActiveWorkflowEnrollment,
} from "./workflow-enrollment-access.service.js";

const student = { id: "student", roles: ["RESEARCHER"] } as any;
const project = {
  id: "project",
  title: "Preserved project",
  members: [{ userId: "student" }],
  workflowInstance: {
    workflowId: "workflow",
    workflow: { stages: [{ tasks: [{ title: "Private task" }] }] },
  },
  taskSubmissions: [{ task: { title: "Private task" } }],
};

describe("researcher workflow enrollment access", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requires active enrollment even when a student retains project membership", async () => {
    db.workflowEnrollment.findFirst.mockResolvedValue(null);
    expect(await hasActiveWorkflowEnrollment("student", "workflow")).toBe(
      false,
    );
    expect(db.workflowEnrollment.findFirst).toHaveBeenCalledWith({
      where: { userId: "student", workflowId: "workflow", status: "ACTIVE" },
      select: { id: true },
    });
  });

  it("grants access to an actively enrolled student", async () => {
    db.workflowEnrollment.findFirst.mockResolvedValue({ id: "enrollment" });
    expect(await hasActiveWorkflowEnrollment("student", "workflow")).toBe(true);
  });

  it("removes nested workflow and task data while preserving the project and original records", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([]);
    const [visible] = await filterResearchWorkflowDetails(student, [project]);
    expect(visible).toMatchObject({
      id: "project",
      title: "Preserved project",
      members: project.members,
      workflowInstance: null,
      taskSubmissions: [],
      workflowAccessRemoved: true,
    });
    expect(project.workflowInstance.workflow.stages).toHaveLength(1);
    expect(project.taskSubmissions).toHaveLength(1);
  });

  it("preserves access to a different enrolled workflow without leaking the removed workflow", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([{ workflowId: "other" }]);
    const otherProject = {
      ...project,
      id: "other-project",
      workflowInstance: { workflowId: "other" },
    };
    const visible = await filterResearchWorkflowDetails(student, [
      project,
      otherProject,
    ]);
    expect(visible[0].workflowInstance).toBeNull();
    expect(visible[1]).toBe(otherProject);
  });

  it("leaves professor access and projects without a workflow unchanged", async () => {
    expect(
      await filterResearchWorkflowDetails(
        { id: "professor", roles: ["RESEARCH_COORDINATOR"] } as any,
        [project],
      ),
    ).toEqual([project]);
    expect(
      await filterResearchWorkflowDetails(student, [
        { id: "unregistered", workflowInstance: null },
      ]),
    ).toEqual([{ id: "unregistered", workflowInstance: null }]);
    expect(db.workflowEnrollment.findMany).not.toHaveBeenCalled();
  });
});
