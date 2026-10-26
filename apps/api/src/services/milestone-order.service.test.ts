import { describe, expect, it, vi } from "vitest";
import { assertMilestoneOrder } from "./milestone-condition.service.js";
const options = {
  workflowId: "workflow",
  currentSequence: 1,
  sequence: 2,
  requiresApproval: false,
};
describe("approval checkpoint ordering before project registration", () => {
  it("prevents future tasks from bypassing adviser or title approval", async () => {
    const db = {
      workflowStage: {
        findFirst: vi.fn().mockResolvedValue({ id: "adviser" }),
      },
    } as any;
    await expect(assertMilestoneOrder(db, options)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.workflowStage.findFirst).toHaveBeenCalledWith({
      where: {
        workflowId: "workflow",
        category: { not: "Archived" },
        requiresApproval: true,
        sequence: { gte: 1, lt: 2 },
      },
      select: { id: true },
    });
  });
  it("keeps professor-configured parallel work available when no prior approval gate blocks it", async () => {
    const db = {
      workflowStage: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;
    await expect(assertMilestoneOrder(db, options)).resolves.toBeUndefined();
  });
  it("does not lock the current milestone behind project registration", async () => {
    const db = { workflowStage: { findFirst: vi.fn() } } as any;
    await expect(
      assertMilestoneOrder(db, {
        ...options,
        sequence: 1,
        requiresApproval: true,
      }),
    ).resolves.toBeUndefined();
    expect(db.workflowStage.findFirst).not.toHaveBeenCalled();
  });
});
