import { Prisma } from "../lib/prisma.js";
import {
  MilestoneConditionError,
  validateMilestoneConditions,
} from "./milestone-condition.service.js";
import { getMilestoneProgress } from "./research-workflow-integration.service.js";

type Db = Prisma.TransactionClient;
type Position = { id: string; topicId: string | null };

const conflict = () =>
  new MilestoneConditionError(
    "This workflow changed while you were arranging it. Refresh and try again.",
    409,
  );
const sameOrder = (left: Position[], right: Position[]) =>
  left.length === right.length &&
  left.every(
    (stage, index) =>
      stage.id === right[index].id && stage.topicId === right[index].topicId,
  );

async function readStages(tx: Db, workflowId: string) {
  return tx.workflowStage.findMany({
    where: { workflowId },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
  });
}

/** Keep identifiers, submissions and approval records; change only structure and gates. */
async function applyOrder(
  tx: Db,
  workflowId: string,
  ordered: Position[],
  actorId: string,
) {
  const stages = await readStages(tx, workflowId);
  const active = stages.filter((stage) => stage.category !== "Archived");
  const activeIds = new Set(active.map((stage) => stage.id));
  if (
    ordered.length !== active.length ||
    new Set(ordered.map((stage) => stage.id)).size !== active.length ||
    ordered.some((stage) => !activeIds.has(stage.id))
  )
    throw new MilestoneConditionError(
      "Milestone order must contain every active milestone in this workflow exactly once.",
      400,
    );

  const archived = stages.filter((stage) => stage.category === "Archived");
  // Vacate every sequence before swapping; the database enforces unique positions.
  const offset =
    Math.max(0, ...stages.map((stage) => Math.abs(stage.sequence))) +
    stages.length +
    1;
  for (let index = 0; index < stages.length; index++)
    await tx.workflowStage.update({
      where: { id: stages[index].id },
      data: { sequence: offset + index },
    });
  for (let index = 0; index < ordered.length; index++)
    await tx.workflowStage.update({
      where: { id: ordered[index].id },
      data: {
        sequence: index + 1,
        topicId: ordered[index].topicId,
        requiredMilestoneId: index ? ordered[index - 1].id : null,
        isFinal: index === ordered.length - 1,
      },
    });
  for (let index = 0; index < archived.length; index++)
    await tx.workflowStage.update({
      where: { id: archived[index].id },
      data: { sequence: -(index + 1), isFinal: false },
    });
  await validateMilestoneConditions(tx, workflowId);

  const instances = await tx.workflowInstance.findMany({
    where: { workflowId },
    select: {
      id: true,
      researchId: true,
      currentStageId: true,
      completedAt: true,
      research: { select: { status: true } },
    },
  });
  for (const instance of instances) {
    const progress = await getMilestoneProgress(tx, instance.researchId);
    const firstIncomplete = progress.find((stage) => !stage.completed);
    // A structural edit must never revoke a released, completed research result.
    if (
      (instance.completedAt || instance.research?.status === "COMPLETED") &&
      firstIncomplete
    )
      throw new MilestoneConditionError(
        "This order would change a completed project's requirements. Duplicate the workflow for a new cohort instead.",
        409,
      );
    const next = firstIncomplete || progress.at(-1);
    if (!next || next.id === instance.currentStageId) continue;
    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { currentStageId: next.id },
    });
    await tx.workflowTransition.create({
      data: {
        workflowInstanceId: instance.id,
        fromStageId: instance.currentStageId,
        toStageId: next.id,
        performedBy: actorId,
        remarks:
          "Workflow reordered. Current milestone aligned with the first unfinished requirement; existing submissions and approvals retained.",
      },
    });
  }
  await tx.workflow.update({
    where: { id: workflowId },
    data: { updatedAt: new Date() },
  });
}

export async function reorderWorkflowMilestones(
  tx: Db,
  workflowId: string,
  input: { stages: Position[]; expectedStages: Position[] },
  actorId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workflowId}))`;
  const active = (await readStages(tx, workflowId)).filter(
    (stage) => stage.category !== "Archived",
  );
  if (!sameOrder(active, input.expectedStages)) throw conflict();
  const topics = await tx.workflowTopic.findMany({
    where: { workflowId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  const topicOrder = new Map<string | null, number>([
    [null, -1],
    ...topics.map((topic, index) => [topic.id, index] as [string, number]),
  ]);
  let lastTopic = -1;
  for (const stage of input.stages) {
    const position = topicOrder.get(stage.topicId);
    if (position === undefined || position < lastTopic)
      throw new MilestoneConditionError(
        "Keep milestones grouped in their workflow's phase order.",
        400,
      );
    lastTopic = position;
  }
  if (sameOrder(active, input.stages)) return false;
  await applyOrder(tx, workflowId, input.stages, actorId);
  return true;
}

export async function reorderWorkflowTopics(
  tx: Db,
  workflowId: string,
  topicIds: string[],
  actorId: string,
  expectedTopicIds?: string[],
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workflowId}))`;
  const topics = await tx.workflowTopic.findMany({
    where: { workflowId },
    orderBy: { sequence: "asc" },
    select: { id: true, sequence: true },
  });
  if (
    expectedTopicIds &&
    (topics.length !== expectedTopicIds.length ||
      topics.some((topic, index) => topic.id !== expectedTopicIds[index]))
  )
    throw conflict();
  const ids = new Set(topics.map((topic) => topic.id));
  if (
    topicIds.length !== ids.size ||
    new Set(topicIds).size !== ids.size ||
    topicIds.some((id) => !ids.has(id))
  )
    throw new MilestoneConditionError(
      "Topic order must contain every workflow topic exactly once.",
      400,
    );
  if (topics.every((topic, index) => topic.id === topicIds[index]))
    return false;
  const offset =
    Math.max(0, ...topics.map((topic) => Math.abs(topic.sequence))) +
    topics.length +
    1;
  for (let index = 0; index < topicIds.length; index++)
    await tx.workflowTopic.update({
      where: { id: topicIds[index] },
      data: { sequence: offset + index },
    });
  for (let index = 0; index < topicIds.length; index++)
    await tx.workflowTopic.update({
      where: { id: topicIds[index] },
      data: { sequence: index + 1 },
    });
  await resequenceMilestonesWithConditions(tx, workflowId, actorId);
  return true;
}

export async function resequenceMilestonesWithConditions(
  tx: Db,
  workflowId: string,
  actorId: string,
) {
  const active = (await readStages(tx, workflowId)).filter(
    (stage) => stage.category !== "Archived",
  );
  const topics = await tx.workflowTopic.findMany({
    where: { workflowId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  const ordered = [
    ...active.filter((stage) => !stage.topicId),
    ...topics.flatMap((topic) =>
      active.filter((stage) => stage.topicId === topic.id),
    ),
  ];
  await applyOrder(tx, workflowId, ordered, actorId);
}
