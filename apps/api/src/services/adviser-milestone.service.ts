import { Prisma } from "../lib/prisma.js";
import {
  advanceMilestoneIfSatisfied,
  createNotificationsOnce,
} from "./research-workflow-integration.service.js";

export async function synchronizeAdviserMilestone(
  tx: Prisma.TransactionClient,
  options: {
    researchId: string;
    actorId: string;
    workflowStageId?: string | null;
  },
) {
  const project = await tx.researchProject.findUnique({
    where: { id: options.researchId },
    select: {
      id: true,
      title: true,
      programId: true,
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          projectRole: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              programId: true,
              status: true,
              roles: { select: { role: { select: { name: true } } } },
            },
          },
        },
      },
      workflowInstance: {
        select: {
          workflowId: true,
          workflow: {
            select: {
              createdBy: true,
              stages: {
                where: { milestoneType: "ADVISER_SELECTION" },
                select: { id: true, name: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  const workflowInstance = project?.workflowInstance;
  const stage = workflowInstance?.workflow.stages.find(
    (candidate) =>
      !options.workflowStageId || candidate.id === options.workflowStageId,
  );
  if (!project || !workflowInstance || !stage)
    return { synchronized: false, progression: null };

  const adviserMember = project.members.find(
    (member) =>
      member.projectRole === "ADVISER" &&
      member.user.status === "ACTIVE" &&
      member.user.programId === project.programId &&
      member.user.roles.some(({ role }) => role.name === "ADVISER"),
  );
  if (!adviserMember)
    return { synchronized: false, stageId: stage.id, progression: null };

  const acceptedRequest = await tx.adviserRequest.findFirst({
    where: {
      researchId: project.id,
      adviserId: adviserMember.userId,
      status: "ACCEPTED",
      OR: [{ workflowStageId: stage.id }, { workflowStageId: null }],
    },
    orderBy: { respondedAt: "desc" },
    select: { id: true, respondedAt: true },
  });
  const progression = await advanceMilestoneIfSatisfied(tx, {
    researchId: project.id,
    milestoneId: stage.id,
    actorId: options.actorId,
  });
  const recipientIds = new Set(
    project.members
      .filter((member) => ["LEADER", "MEMBER"].includes(member.projectRole))
      .map((member) => member.userId),
  );
  recipientIds.add(workflowInstance.workflow.createdBy);
  const acceptedAt = acceptedRequest?.respondedAt || adviserMember.joinedAt;
  const adviserName =
    `${adviserMember.user.firstName || ""} ${adviserMember.user.lastName || ""}`.trim() ||
    adviserMember.user.email;
  await createNotificationsOnce(
    tx,
    Array.from(recipientIds).map((recipientId) => ({
      recipientId,
      type: "WORKFLOW_CHANGED",
      title: "Adviser milestone approved",
      message: `${adviserName} is now the official adviser for ${project.title}.`,
      entityType: "WorkflowStage",
      entityId: stage.id,
      actionUrl: `/research/manuscript?projectId=${project.id}&milestoneId=${stage.id}`,
      deduplicationKey: `adviser-milestone:${project.id}:${stage.id}:${adviserMember.userId}:approved:${recipientId}`,
    })),
  );
  return {
    synchronized: true,
    stageId: stage.id,
    adviser: adviserMember.user,
    acceptedAt,
    progression,
  };
}
