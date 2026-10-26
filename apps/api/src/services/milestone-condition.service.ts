import { Prisma, prisma } from "../lib/prisma.js";
import { getMilestoneProgress } from "./research-workflow-integration.service.js";

type DbClient = Prisma.TransactionClient | typeof prisma;
export class MilestoneConditionError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}
export function parseRequiredMilestoneId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new MilestoneConditionError(
      "Choose a valid Required Milestone Condition.",
      400,
    );
  }
  return value;
}

export async function validateMilestoneConditions(
  db: DbClient,
  workflowId: string,
) {
  const stages = await db.workflowStage.findMany({
    where: { workflowId, category: { not: "Archived" } },
    select: { id: true, name: true, sequence: true, requiredMilestoneId: true },
  });
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  for (const stage of stages) {
    if (!stage.requiredMilestoneId) continue;
    const required = byId.get(stage.requiredMilestoneId);
    if (
      !required ||
      required.id === stage.id ||
      required.sequence >= stage.sequence
    ) {
      throw new MilestoneConditionError(
        `The Required Milestone Condition for “${stage.name}” must be an earlier, active milestone in the same workflow. Update the condition or workflow order first.`,
        400,
      );
    }
  }
}

export async function assertMilestoneCondition(
  db: DbClient,
  researchId: string,
  milestoneId: string,
) {
  const stage = await db.workflowStage.findUnique({
    where: { id: milestoneId },
    select: { requiredMilestoneId: true },
  });
  if (!stage?.requiredMilestoneId) return;
  const progress = await getMilestoneProgress(db, researchId);
  const milestone = progress.find((item) => item.id === milestoneId);
  if (!milestone || !milestone.requiredMilestoneSatisfied) {
    throw new MilestoneConditionError(
      `Complete and obtain approval for “${milestone?.requiredMilestone?.name || "the required milestone"}” before starting this milestone.`,
    );
  }
}

export async function assertMilestoneNotRequired(
  db: DbClient,
  stageId: string,
) {
  const dependents = await db.workflowStage.findMany({
    where: { requiredMilestoneId: stageId, category: { not: "Archived" } },
    select: { name: true },
  });
  if (dependents.length)
    throw new MilestoneConditionError(
      `This milestone is required by ${dependents.map((stage) => `“${stage.name}”`).join(", ")}. Change their Required Milestone Condition before removing it.`,
    );
}

// Optional parallel work may not jump over a professor's approval checkpoint.
export async function assertMilestoneOrder(db: DbClient, options: {
  workflowId: string; currentSequence?: number; sequence: number; requiresApproval: boolean;
}) {
  if (options.currentSequence === undefined || options.sequence <= options.currentSequence) return;
  const blocked = options.requiresApproval || await db.workflowStage.findFirst({
    where: { workflowId: options.workflowId, category: { not: "Archived" }, requiresApproval: true, sequence: { gte: options.currentSequence, lt: options.sequence } },
    select: { id: true },
  });
  if (blocked) throw new MilestoneConditionError("Complete the preceding approval milestones before starting this task.");
}
