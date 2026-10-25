import { Prisma } from "../lib/prisma.js";
import {
  assertMilestoneAvailable,
  getGroupMilestones,
  lockMilestoneProject,
  MilestoneEligibilityError,
} from "./milestone-eligibility.service.js";

export async function reconcileMilestoneNavigation(
  tx: Prisma.TransactionClient,
  researchId: string,
) {
  const milestones = await getGroupMilestones(tx, researchId);
  const instance = await tx.workflowInstance.findUniqueOrThrow({
    where: { researchId },
  });
  const allComplete =
    milestones.length > 0 && milestones.every((stage) => stage.completed);
  const next =
    milestones.find(
      (stage) => stage.status === "REVISION_REQUIRED" && !stage.locked,
    ) ||
    milestones.find((stage) => !stage.completed && !stage.locked) ||
    milestones.find((stage) => !stage.completed);
  const nextId = next?.id || milestones.at(-1)?.id || null;
  await tx.workflowInstance.update({
    where: { researchId },
    data: {
      currentStageId: nextId,
      completedAt: allComplete ? instance.completedAt || new Date() : null,
    },
  });
  const project = await tx.researchProject.findUniqueOrThrow({
    where: { id: researchId },
  });
  if (allComplete) {
    await tx.researchProject.update({
      where: { id: researchId },
      data: {
        status: "COMPLETED",
        completedAt: instance.completedAt || new Date(),
      },
    });
  } else if (project.status === "COMPLETED") {
    await tx.researchProject.update({
      where: { id: researchId },
      data: { status: "REVISION", completedAt: null },
    });
  }
  return {
    completed: allComplete,
    nextStageName: next?.name,
    advanced: instance.currentStageId !== nextId,
  };
}

export async function recordMilestoneApproval(
  tx: Prisma.TransactionClient,
  input: {
    researchId: string;
    milestoneId: string;
    actorId: string;
    reason?: string;
    reconfirm?: boolean;
    manual?: boolean;
  },
) {
  await lockMilestoneProject(tx, input.researchId);
  const progress = await getGroupMilestones(tx, input.researchId);
  const milestone = progress.find((stage) => stage.id === input.milestoneId);
  if (!milestone)
    throw new MilestoneEligibilityError("Milestone not found.", 404);
  if (milestone.locked)
    throw new MilestoneEligibilityError(milestone.blockedReason!);
  if (!input.manual && !milestone.ownRequirementsSatisfied) return false;
  if (
    input.manual &&
    milestone.requiresDocument &&
    !milestone.ownRequirementsSatisfied
  )
    throw new MilestoneEligibilityError(
      "Approve all required submissions through their assigned review process first.",
    );
  if (milestone.capturesResearchTitle && !milestone.proposedTitle?.trim())
    throw new MilestoneEligibilityError(
      "The group must submit a proposed research title before this milestone can pass.",
    );
  if (milestone.needsRevalidation && !input.reconfirm) return false;
  const current = await tx.projectMilestoneState.findUnique({
    where: {
      researchId_stageId: {
        researchId: input.researchId,
        stageId: input.milestoneId,
      },
    },
  });
  if (
    current?.decision === "APPROVED" &&
    !milestone.needsRevalidation &&
    milestone.completed
  )
    return true;
  const data = {
    decision: "APPROVED",
    approvalBasis: milestone.approvalBasis,
    reason: input.reason || "All required milestone decisions were approved.",
  };
  await tx.projectMilestoneState.upsert({
    where: {
      researchId_stageId: {
        researchId: input.researchId,
        stageId: input.milestoneId,
      },
    },
    create: {
      researchId: input.researchId,
      stageId: input.milestoneId,
      ...data,
    },
    update: data,
  });
  const event = await tx.milestoneDecisionEvent.create({
    data: {
      researchId: input.researchId,
      stageId: input.milestoneId,
      actorId: input.actorId,
      decision: input.reconfirm ? "RECONFIRMED" : "APPROVED",
      generation: milestone.generation,
      reason: data.reason,
      details: {
        approvalBasis: milestone.approvalBasis,
        proposedTitle: milestone.proposedTitle,
        submissions: milestone.tasks.map((task) => ({
          taskId: task.id,
          submissionId: task.submissionId,
          documentVersionId: task.documentVersionId,
          status: task.status,
        })),
      },
    },
  });
  if (milestone.capturesResearchTitle && milestone.proposedTitle) {
    const project = await tx.researchProject.findUniqueOrThrow({
      where: { id: input.researchId },
    });
    await tx.researchTitleRevision.create({
      data: {
        researchId: project.id,
        previousTitle: project.title,
        proposedTitle: milestone.proposedTitle,
        requestedBy: project.createdBy,
        reviewedBy: input.actorId,
        reviewedAt: new Date(),
        status: "ACCEPTED",
        reason: `Approved through milestone: ${milestone.name}`,
        reviewNote: data.reason,
      },
    });
    await tx.researchProject.update({
      where: { id: project.id },
      data: { title: milestone.proposedTitle },
    });
  }
  if (milestone.availabilityMode === "PREREQUISITES" || input.manual) {
    const members = await tx.researchMember.findMany({
      where: {
        researchId: input.researchId,
        leftAt: null,
        projectRole: { in: ["LEADER", "MEMBER"] },
      },
      select: { userId: true },
    });
    await tx.notification.createMany({
      data: members.map((member) => ({
        recipientId: member.userId,
        type: "WORKFLOW_CHANGED" as const,
        title: `${milestone.name}: passed`,
        message: data.reason,
        entityType: "WorkflowStage",
        entityId: input.milestoneId,
        actionUrl: `/student/tasks?projectId=${input.researchId}`,
        deduplicationKey: `milestone-decision:${event.id}:${member.userId}`,
      })),
      skipDuplicates: true,
    });
  }
  return true;
}

export async function requestMilestoneRevision(
  tx: Prisma.TransactionClient,
  input: {
    researchId: string;
    milestoneId: string;
    actorId: string;
    reason: string;
    taskIds?: string[];
  },
) {
  await lockMilestoneProject(tx, input.researchId);
  const before = await getGroupMilestones(tx, input.researchId);
  const milestone = before.find((stage) => stage.id === input.milestoneId);
  if (!milestone)
    throw new MilestoneEligibilityError("Milestone not found.", 404);
  if (milestone.status === "REVISION_REQUIRED")
    throw new MilestoneEligibilityError(
      "This milestone already needs revision. Its existing request is still active.",
    );
  if (!milestone.ownRequirementsSatisfied && !milestone.needsRevalidation)
    throw new MilestoneEligibilityError(
      "Only a passed milestone or one needing revalidation can be reopened.",
    );
  const required = milestone.requiresDocument
    ? milestone.tasks.filter(
        (task) => task.isRequired || task.status === "APPROVED",
      )
    : [];
  const ids = input.taskIds ?? required.map((task) => task.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !required.some((task) => task.id === id)) ||
    (required.length && !ids.length)
  )
    throw new MilestoneEligibilityError(
      "Select at least one valid required task to revise.",
      400,
    );
  const generation = milestone.generation + 1;
  const reopenedAt = new Date();
  const selected = milestone.tasks.filter((task) => ids.includes(task.id));
  const documentIds = selected
    .map((task) => task.documentId)
    .filter((id): id is string => Boolean(id));
  const documents = await tx.document.findMany({
    where: {
      researchId: input.researchId,
      OR: [
        { id: { in: documentIds } },
        ...(ids.length ? [] : [{ milestoneId: input.milestoneId }]),
      ],
    },
  });
  if (documents.some((doc) => doc.lifecycleStatus === "FINALIZED"))
    throw new MilestoneEligibilityError(
      "This milestone has finalized documents. Use the existing official-record correction process before reopening it.",
    );
  // Capture the original pass before changing the current summary. Submitted
  // snapshots, completed reviewer decisions and past attempt decisions stay intact.
  await tx.milestoneDecisionEvent.create({
    data: {
      researchId: input.researchId,
      stageId: input.milestoneId,
      actorId: input.actorId,
      decision: "REVISION_REQUIRED",
      generation,
      reason: input.reason,
      details: {
        previousDecision: milestone.decision,
        previousStatus: milestone.status,
        taskIds: ids,
        previousSubmissions: selected.map((task) => ({
          taskId: task.id,
          submissionId: task.submissionId,
          documentVersionId: task.documentVersionId,
          status: task.status,
        })),
        approvalBasis: milestone.approvalBasis,
      },
    },
  });
  await tx.projectMilestoneState.upsert({
    where: {
      researchId_stageId: {
        researchId: input.researchId,
        stageId: input.milestoneId,
      },
    },
    create: {
      researchId: input.researchId,
      stageId: input.milestoneId,
      decision: "REVISION_REQUIRED",
      generation,
      reopenedAt,
      revisionTaskIds: ids,
      reason: input.reason,
    },
    update: {
      decision: "REVISION_REQUIRED",
      generation,
      reopenedAt,
      revisionTaskIds: ids,
      reason: input.reason,
    },
  });
  await tx.taskSubmission.updateMany({
    where: { researchId: input.researchId, taskId: { in: ids } },
    data: {
      status: "REVISION_REQUIRED",
      reviewNote: input.reason,
      reviewedAt: reopenedAt,
    },
  });
  for (const document of documents) {
    const changed = await tx.document.updateMany({
      where: { id: document.id, lifecycleStatus: document.lifecycleStatus },
      data: { lifecycleStatus: "REVISION_REQUIRED" },
    });
    if (!changed.count)
      throw new MilestoneEligibilityError(
        "A document changed while this milestone was being reopened. Refresh before trying again.",
      );
    await tx.manuscriptStatusEvent.create({
      data: {
        documentId: document.id,
        fromStatus: document.lifecycleStatus,
        toStatus: "REVISION_REQUIRED",
        actorId: input.actorId,
        reason: input.reason,
        metadata: { milestoneId: input.milestoneId, generation },
      },
    });
  }
  // Materialize the impact so old approved dependents cannot revive when the
  // prerequisite passes again, including legacy approvals without a saved basis.
  const affected = new Set([input.milestoneId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const stage of before)
      if (
        !affected.has(stage.id) &&
        stage.prerequisiteIds.some((id) => affected.has(id))
      ) {
        affected.add(stage.id);
        changed = true;
      }
  }
  for (const stage of before.filter(
    (stage) =>
      stage.id !== input.milestoneId &&
      affected.has(stage.id) &&
      stage.ownRequirementsSatisfied,
  )) {
    await tx.projectMilestoneState.upsert({
      where: {
        researchId_stageId: { researchId: input.researchId, stageId: stage.id },
      },
      create: {
        researchId: input.researchId,
        stageId: stage.id,
        decision: "NEEDS_REVALIDATION",
        generation: stage.generation,
        approvalBasis: stage.approvalBasis,
      },
      update: { decision: "NEEDS_REVALIDATION" },
    });
    await tx.milestoneDecisionEvent.create({
      data: {
        researchId: input.researchId,
        stageId: stage.id,
        actorId: input.actorId,
        decision: "NEEDS_REVALIDATION",
        generation: stage.generation,
        reason: `Prerequisite reopened: ${milestone.name}. ${input.reason}`,
        details: { prerequisiteId: input.milestoneId },
      },
    });
  }
  await reconcileMilestoneNavigation(tx, input.researchId);
  await tx.researchProject.updateMany({
    where: { id: input.researchId, status: "REJECTED" },
    data: { status: "REVISION", completedAt: null },
  });
  const members = await tx.researchMember.findMany({
    where: {
      researchId: input.researchId,
      leftAt: null,
      projectRole: { in: ["LEADER", "MEMBER"] },
    },
    select: { userId: true },
  });
  await tx.notification.createMany({
    data: members.map((member) => ({
      recipientId: member.userId,
      type: "REVISION_REQUESTED" as const,
      title: `${milestone.name}: revision required`,
      message: input.reason,
      entityType: "WorkflowStage",
      entityId: input.milestoneId,
      actionUrl: `/student/tasks?projectId=${input.researchId}`,
      deduplicationKey: `milestone:${input.researchId}:${input.milestoneId}:revision:${generation}:${member.userId}`,
    })),
    skipDuplicates: true,
  });
  return { affectedMilestoneIds: [...affected], generation };
}

export { assertMilestoneAvailable };
