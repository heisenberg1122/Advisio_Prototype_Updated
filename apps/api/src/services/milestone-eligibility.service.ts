import { Prisma, prisma } from "../lib/prisma.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class MilestoneEligibilityError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
    public code = "MILESTONE_NOT_AVAILABLE",
  ) {
    super(message);
  }
}

export type MilestoneNode = {
  id: string;
  name: string;
  sequence: number;
  requiresApproval: boolean;
  prerequisiteIds: string[];
  ownRequirementsSatisfied: boolean;
  generation: number;
  decision: string;
  approvalBasis: Record<string, number> | null;
};

export function validatePrerequisiteGraph(
  nodes: Array<{ id: string; prerequisiteIds: string[] }>,
) {
  const graph = new Map(nodes.map((node) => [node.id, node.prerequisiteIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new MilestoneEligibilityError(
        "Milestone prerequisites cannot form a circular dependency.",
        400,
        "PREREQUISITE_CYCLE",
      );
    if (visited.has(id)) return;
    if (!graph.has(id))
      throw new MilestoneEligibilityError(
        "Choose active prerequisite milestones from this workflow.",
        400,
        "INVALID_PREREQUISITE",
      );
    visiting.add(id);
    const prerequisites = graph.get(id)!;
    if (new Set(prerequisites).size !== prerequisites.length)
      throw new MilestoneEligibilityError(
        "A prerequisite can only be selected once.",
        400,
        "DUPLICATE_PREREQUISITE",
      );
    for (const prerequisite of prerequisites) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}

/** Decision and availability are separate: a blocked historical pass is not a valid pass. */
export function evaluateMilestoneGraph(
  nodes: MilestoneNode[],
  mode: string,
  currentSequence: number,
) {
  const graph = new Map(nodes.map((node) => [node.id, node]));
  const results = new Map<
    string,
    {
      completed: boolean;
      locked: boolean;
      needsRevalidation: boolean;
      unmetPrerequisiteIds: string[];
      approvalBasis: Record<string, number>;
    }
  >();
  const visiting = new Set<string>();
  const evaluate = (
    id: string,
  ): NonNullable<ReturnType<typeof results.get>> => {
    const previous = results.get(id);
    if (previous) return previous;
    const node = graph.get(id);
    if (!node || visiting.has(id))
      return {
        completed: false,
        locked: true,
        needsRevalidation: false,
        unmetPrerequisiteIds: [id],
        approvalBasis: {},
      };
    visiting.add(id);
    const prerequisites = mode === "PREREQUISITES" ? node.prerequisiteIds : [];
    const unmetPrerequisiteIds = prerequisites.filter(
      (required) => !evaluate(required).completed,
    );
    // Include transitive generations: changes anywhere in the approval's basis
    // require an explicit reconfirmation rather than silently reviving a pass.
    const basis: Record<string, number> = {};
    for (const prerequisiteId of prerequisites) {
      const required = graph.get(prerequisiteId);
      if (required) basis[prerequisiteId] = required.generation;
      Object.assign(basis, evaluate(prerequisiteId).approvalBasis);
    }
    const oldBasis = node.approvalBasis;
    const changedBasis =
      oldBasis !== null &&
      (Object.keys(oldBasis).length !== Object.keys(basis).length ||
        Object.entries(basis).some(([key, value]) => oldBasis[key] !== value));
    const needsRevalidation =
      node.decision === "NEEDS_REVALIDATION" ||
      (node.ownRequirementsSatisfied && changedBasis);
    const locked =
      unmetPrerequisiteIds.length > 0 ||
      (mode !== "PREREQUISITES" &&
        node.requiresApproval &&
        node.sequence > currentSequence);
    const result = {
      completed:
        node.ownRequirementsSatisfied &&
        !unmetPrerequisiteIds.length &&
        !needsRevalidation,
      locked,
      needsRevalidation,
      unmetPrerequisiteIds,
      approvalBasis: basis,
    };
    visiting.delete(id);
    results.set(id, result);
    return result;
  };
  for (const node of nodes) evaluate(node.id);
  return results;
}

export async function lockMilestoneProject(
  tx: Prisma.TransactionClient,
  researchId: string,
) {
  const instance = await tx.workflowInstance.findUnique({
    where: { researchId },
    select: { workflowId: true },
  });
  if (!instance)
    throw new MilestoneEligibilityError(
      "This project has no assigned workflow.",
      409,
      "WORKFLOW_REQUIRED",
    );
  // Configuration edits and group decisions take locks in this same order.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-access:${instance.workflowId}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`milestone-workflow:${instance.workflowId}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`milestone-project:${researchId}`}))`;
  return instance;
}

export async function getGroupMilestones(client: DbClient, researchId: string) {
  const instance = await client.workflowInstance.findUnique({
    where: { researchId },
    include: {
      currentStage: true,
      workflow: {
        include: {
          stages: {
            where: { category: { not: "Archived" } },
            orderBy: { sequence: "asc" },
            include: {
              topic: true,
              prerequisites: true,
              projectStates: { where: { researchId } },
              tasks: {
                orderBy: { sequence: "asc" },
                include: {
                  submissions: {
                    where: { researchId },
                    include: {
                      attempts: { orderBy: { attemptNumber: "desc" } },
                    },
                  },
                },
              },
              submittedVersions: {
                where: {
                  document: { researchId },
                  isImmutable: true,
                  manuscriptStatus: { in: ["APPROVED", "FINALIZED"] },
                },
                select: { id: true, submittedAt: true },
              },
            },
          },
        },
      },
    },
  });
  if (!instance) return [];
  const raw = instance.workflow.stages.map((stage) => {
    const state = stage.projectStates[0];
    const revisionTaskIds = Array.isArray(state?.revisionTaskIds)
      ? (state.revisionTaskIds as string[])
      : [];
    const tasks = stage.tasks.map((task) => {
      const submission = task.submissions[0];
      const fresh =
        !state?.reopenedAt ||
        !revisionTaskIds.includes(task.id) ||
        Boolean(submission && submission.submittedAt > state.reopenedAt);
      return {
        id: task.id,
        title: task.title,
        sequence: task.sequence,
        isRequired: task.isRequired,
        status: submission?.status || null,
        submissionId: submission?.id || null,
        documentId: submission?.documentId || null,
        documentVersionId: submission?.documentVersionId || null,
        submittedAt: submission?.submittedAt || null,
        reviewedAt: submission?.reviewedAt || null,
        attempts: submission?.attempts || [],
        approved: submission?.status === "APPROVED" && fresh,
      };
    });
    const required = stage.requiresDocument
      ? tasks.filter((task) => task.isRequired)
      : [];
    const approvedRequired = required.filter((task) => task.approved).length;
    const documentSatisfied =
      !stage.requiresDocument ||
      required.some((task) => task.approved && task.documentId) ||
      stage.submittedVersions.some(
        (version) =>
          !state?.reopenedAt ||
          Boolean(
            version.submittedAt && version.submittedAt > state.reopenedAt,
          ),
      );
    const total = required.length + (stage.requiresDocument ? 1 : 0);
    const done =
      approvedRequired + (stage.requiresDocument && documentSatisfied ? 1 : 0);
    const manualRequired = total === 0;
    const ownRequirementsSatisfied =
      (manualRequired
        ? state?.decision === "APPROVED"
        : total > 0 && done === total) &&
      (!stage.capturesResearchTitle || Boolean(state?.proposedTitle?.trim())) &&
      (!stage.requiresDocument ||
        revisionTaskIds.every((id) =>
          tasks.some((task) => task.id === id && task.approved),
        ));
    const hasActivity =
      tasks.some((task) => task.status || task.attempts.length) ||
      Boolean(state);
    const awaitingRevision =
      state?.decision === "REVISION_REQUIRED" &&
      (revisionTaskIds.length === 0 ||
        tasks.some(
          (task) =>
            revisionTaskIds.includes(task.id) &&
            (!task.submittedAt ||
              Boolean(
                state.reopenedAt && task.submittedAt <= state.reopenedAt,
              )),
        ));
    const status = ownRequirementsSatisfied
      ? "COMPLETED"
      : awaitingRevision ||
          tasks.some(
            (task) =>
              task.status === "REVISION_REQUIRED" || task.status === "REJECTED",
          )
        ? "REVISION_REQUIRED"
        : tasks.some((task) =>
              ["SUBMITTED", "UNDER_REVIEW"].includes(task.status || ""),
            )
          ? "AWAITING_REVIEW"
          : tasks.some((task) => task.status) &&
              tasks
                .filter((task) => task.status)
                .every((task) => task.status === "APPROVED")
            ? "APPROVED"
            : hasActivity
              ? "IN_PROGRESS"
              : "NOT_STARTED";
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      sequence: stage.sequence,
      topic: stage.topic,
      requiresDocument: stage.requiresDocument,
      requiresApproval: stage.requiresApproval,
      capturesResearchTitle: stage.capturesResearchTitle,
      isFinal: stage.isFinal,
      isCurrent: instance.currentStageId === stage.id,
      tasks,
      generation: state?.generation || 0,
      decision: state?.decision || "PENDING",
      reason: state?.reason || null,
      proposedTitle: state?.proposedTitle || null,
      prerequisiteIds: stage.prerequisites.map((item) => item.prerequisiteId),
      ownRequirementsSatisfied,
      approvalBasis:
        state?.decision === "APPROVED"
          ? (state.approvalBasis as Record<string, number>)
          : null,
      status,
      documentRequirementSatisfied: documentSatisfied,
      totalRequirements: total || 1,
      completedRequirements: total ? done : ownRequirementsSatisfied ? 1 : 0,
      availabilityMode: instance.workflow.availabilityMode,
    };
  });
  const evaluation = evaluateMilestoneGraph(
    raw,
    instance.workflow.availabilityMode,
    instance.currentStage?.sequence || 0,
  );
  return raw.map((stage) => {
    const result = evaluation.get(stage.id)!;
    const unmetPrerequisites = result.unmetPrerequisiteIds.map((id) => {
      const prerequisite = raw.find((item) => item.id === id);
      return {
        id,
        name: prerequisite?.name || "Unavailable milestone",
        topic: prerequisite?.topic?.title || null,
      };
    });
    const prerequisites = stage.prerequisiteIds.map((id) => {
      const prerequisite = raw.find((item) => item.id === id);
      return {
        id,
        name: prerequisite?.name || "Unavailable milestone",
        topic: prerequisite?.topic?.title || null,
        passed: evaluation.get(id)?.completed || false,
      };
    });
    const blockedReason = unmetPrerequisites.length
      ? `Pass ${unmetPrerequisites.map((item) => `${item.topic ? `${item.topic} → ` : ""}${item.name}`).join(", ")} before continuing.`
      : result.locked
        ? "Complete the preceding milestone before continuing."
        : null;
    const completedRequirements = result.completed
      ? stage.totalRequirements
      : Math.min(stage.completedRequirements, stage.totalRequirements - 1);
    return {
      ...stage,
      ...result,
      prerequisites,
      unmetPrerequisites,
      independent:
        instance.workflow.availabilityMode === "PREREQUISITES" &&
        !stage.prerequisiteIds.length,
      status: result.needsRevalidation ? "NEEDS_REVALIDATION" : stage.status,
      blockedReason,
      completedRequirements,
      completionPercent: Math.round(
        (completedRequirements / stage.totalRequirements) * 100,
      ),
    };
  });
}

export async function assertMilestoneAvailable(
  client: DbClient,
  researchId: string,
  stageId: string,
) {
  const milestones = await getGroupMilestones(client, researchId);
  const milestone = milestones.find((stage) => stage.id === stageId);
  if (!milestone)
    throw new MilestoneEligibilityError(
      "This milestone is not active in the project's workflow.",
      404,
    );
  if (milestone.locked)
    throw new MilestoneEligibilityError(
      milestone.blockedReason ||
        "This milestone is blocked by its prerequisites.",
    );
  if (milestone.needsRevalidation)
    throw new MilestoneEligibilityError(
      "Your professor must revalidate this milestone or request a new submission.",
      409,
      "MILESTONE_REVALIDATION_REQUIRED",
    );
  return milestone;
}

export async function setMilestonePrerequisites(
  tx: Prisma.TransactionClient,
  workflowId: string,
  stageId: string,
  prerequisiteIds: string[],
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`milestone-workflow:${workflowId}`}))`;
  const stages = await tx.workflowStage.findMany({
    where: { workflowId, category: { not: "Archived" } },
    include: { prerequisites: true },
  });
  if (!stages.some((stage) => stage.id === stageId))
    throw new MilestoneEligibilityError(
      "Choose an active milestone in this workflow.",
      404,
    );
  validatePrerequisiteGraph(
    stages.map((stage) => ({
      id: stage.id,
      prerequisiteIds:
        stage.id === stageId
          ? prerequisiteIds
          : stage.prerequisites.map((item) => item.prerequisiteId),
    })),
  );
  const currentIds = stages
    .find((stage) => stage.id === stageId)!
    .prerequisites.map((item) => item.prerequisiteId);
  if (
    currentIds.length === prerequisiteIds.length &&
    currentIds.every((id) => prerequisiteIds.includes(id))
  )
    return;
  await captureMilestoneApprovalBases(tx, workflowId);
  await tx.milestonePrerequisite.deleteMany({ where: { stageId } });
  if (prerequisiteIds.length)
    await tx.milestonePrerequisite.createMany({
      data: prerequisiteIds.map((prerequisiteId) => ({
        stageId,
        prerequisiteId,
      })),
    });
  const instances = await tx.workflowInstance.findMany({
    where: { workflowId, workflow: { availabilityMode: "PREREQUISITES" } },
    select: { researchId: true },
  });
  for (const instance of instances) {
    const milestones = await getGroupMilestones(tx, instance.researchId);
    if (milestones.some((stage) => !stage.completed)) {
      const next =
        milestones.find((stage) => !stage.completed && !stage.locked) ||
        milestones.find((stage) => !stage.completed);
      await tx.workflowInstance.update({
        where: { researchId: instance.researchId },
        data: { completedAt: null, currentStageId: next?.id },
      });
      await tx.researchProject.updateMany({
        where: { id: instance.researchId, status: "COMPLETED" },
        data: { status: "REVISION", completedAt: null },
      });
    }
  }
}

/** Capture only real, project-scoped approvals before a dependency edit. */
export async function captureMilestoneApprovalBases(
  tx: Prisma.TransactionClient,
  workflowId: string,
) {
  const instances = await tx.workflowInstance.findMany({
    where: { workflowId },
    select: { researchId: true },
  });
  for (const instance of instances) {
    const milestones = await getGroupMilestones(tx, instance.researchId);
    for (const stage of milestones.filter((stage) => stage.completed)) {
      await tx.projectMilestoneState.upsert({
        where: {
          researchId_stageId: {
            researchId: instance.researchId,
            stageId: stage.id,
          },
        },
        create: {
          researchId: instance.researchId,
          stageId: stage.id,
          decision: "APPROVED",
          generation: stage.generation,
          approvalBasis: stage.approvalBasis,
        },
        update: {},
      });
    }
  }
}
