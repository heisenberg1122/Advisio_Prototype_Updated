import { describe, expect, it, vi } from "vitest";
import { announcementScope } from "./announcement-scope.service.js";
const actor = {
  id: "professor",
  collegeId: "college",
  programId: "program",
  firstName: "Ana",
  lastName: "Reyes",
  roles: ["RESEARCH_COORDINATOR"],
} as any;
const db = () =>
  ({
    researchType: { findMany: vi.fn().mockResolvedValue([{ id: "type" }]) },
    workflow: {
      findFirst: vi.fn().mockResolvedValue({ id: "workflow", name: "Methods" }),
    },
    program: {
      findFirst: vi.fn().mockResolvedValue({ name: "Computer Science" }),
    },
  }) as any;
describe("announcement email audience", () => {
  it("requires an owned published workflow for professor announcements", async () => {
    const tx = db();
    await expect(announcementScope(tx, actor, {})).rejects.toMatchObject({
      statusCode: 400,
    });
    const scope = await announcementScope(tx, actor, {
      workflowId: "workflow",
    });
    expect(tx.workflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdBy: actor.id,
          status: "PUBLISHED",
        }),
      }),
    );
    expect(scope.recipients).toMatchObject({
      collegeId: "college",
      OR: [
        {
          workflowEnrollments: {
            some: { workflowId: "workflow", status: "ACTIVE" },
          },
        },
        {
          memberships: {
            some: {
              leftAt: null,
              projectRole: { in: ["ADVISER", "PANELIST", "COORDINATOR"] },
              research: { workflowInstance: { workflowId: "workflow" } },
            },
          },
        },
      ],
    });
    tx.workflow.findFirst.mockResolvedValue(null);
    await expect(
      announcementScope(tx, actor, { workflowId: "foreign-workflow" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it("keeps dean notices inside their assigned department and rejects foreign departments", async () => {
    const tx = db();
    const scope = await announcementScope(
      tx,
      { ...actor, roles: ["DEAN"] },
      { programId: "foreign-program" },
    );
    expect(scope.recipients).toEqual({
      collegeId: "college",
      programId: "program",
    });
    tx.program.findFirst.mockResolvedValue(null);
    await expect(
      announcementScope(
        tx,
        { ...actor, programId: null, roles: ["DEAN"] },
        { programId: "foreign-program" },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
