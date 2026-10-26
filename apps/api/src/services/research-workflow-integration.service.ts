import {
  ManuscriptLifecycleStatus,
  Prisma,
  TaskSubmissionStatus,
  prisma,
} from "../lib/prisma.js";
import { notificationDeliveries } from "./notification.service.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type MilestoneDisplayStatus =
  | "BLOCKED"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AWAITING_REVIEW"
  | "REVISION_REQUIRED"
  | "PENDING_ADVISER"
  | "DECLINED"
  | "APPROVED"
  | "COMPLETED";

export type AdviserMilestoneStatus =
  | "NOT_STARTED"
  | "PENDING_ADVISER"
  | "DECLINED"
  | "APPROVED";

export function taskStatusForManuscript(
  status: ManuscriptLifecycleStatus,
): TaskSubmissionStatus {
  if (status === ManuscriptLifecycleStatus.IN_REVIEW)
    return TaskSubmissionStatus.UNDER_REVIEW;
  if (status === ManuscriptLifecycleStatus.REVISION_REQUIRED)
    return TaskSubmissionStatus.REVISION_REQUIRED;
  if (
    status === ManuscriptLifecycleStatus.APPROVED ||
    status === ManuscriptLifecycleStatus.FINALIZED
  )
    return TaskSubmissionStatus.APPROVED;
  return TaskSubmissionStatus.SUBMITTED;
}

export async function createNotificationsOnce(
  tx: DbClient,
  notifications: Array<{
    recipientId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: string | null;
    actionUrl?: string | null;
    deduplicationKey: string;
    audience?: string;
  }>,
) {
  if (!notifications.length) return 0;
  const result = await tx.notification.createMany({
    data: await notificationDeliveries(tx, notifications),
    skipDuplicates: true,
  });
  return result.count;
}

export async function recordTaskSubmissionAttempt(
  tx: Prisma.TransactionClient,
  options: {
    researchId: string;
    taskId: string;
    milestoneId: string;
    documentId: string;
    documentVersionId: string;
    submittedBy: string;
    submittedAt: Date;
    note?: string | null;
    lifecycleStatus: ManuscriptLifecycleStatus;
  },
) {
  const existingSummary = await tx.taskSubmission.findUnique({
    where: {
      researchId_taskId: {
        researchId: options.researchId,
        taskId: options.taskId,
      },
    },
    include: {
      attempts: {
        orderBy: { attemptNumber: "desc" },
        take: 1,
        select: { attemptNumber: true },
      },
    },
  });
  if (existingSummary) {
    const duplicate = await tx.taskSubmissionAttempt.findUnique({
      where: {
        taskSubmissionId_documentVersionId: {
          taskSubmissionId: existingSummary.id,
          documentVersionId: options.documentVersionId,
        },
      },
    });
    if (duplicate)
      return { summary: existingSummary, attempt: duplicate, duplicate: true };
  }

  const taskStatus = taskStatusForManuscript(options.lifecycleStatus);
  const summary = existingSummary
    ? await tx.taskSubmission.update({
        where: { id: existingSummary.id },
        data: {
          documentId: options.documentId,
          documentVersionId: options.documentVersionId,
          submittedBy: options.submittedBy,
          status: taskStatus,
          note: options.note?.trim() || null,
          reviewNote: null,
          reviewedAt: null,
          submittedAt: options.submittedAt,
        },
      })
    : await tx.taskSubmission.create({
        data: {
          researchId: options.researchId,
          taskId: options.taskId,
          documentId: options.documentId,
          documentVersionId: options.documentVersionId,
          submittedBy: options.submittedBy,
          status: taskStatus,
          note: options.note?.trim() || null,
          submittedAt: options.submittedAt,
        },
      });
  const attemptNumber = (existingSummary?.attempts[0]?.attemptNumber || 0) + 1;
  const attempt = await tx.taskSubmissionAttempt.create({
    data: {
      taskSubmissionId: summary.id,
      researchId: options.researchId,
      taskId: options.taskId,
      milestoneId: options.milestoneId,
      documentId: options.documentId,
      documentVersionId: options.documentVersionId,
      attemptNumber,
      submittedBy: options.submittedBy,
      status: taskStatus,
      note: options.note?.trim() || null,
      submittedAt: options.submittedAt,
    },
  });
  return { summary, attempt, duplicate: false };
}

export async function synchronizeTaskAttemptLifecycle(
  tx: Prisma.TransactionClient,
  options: {
    documentVersionId: string;
    lifecycleStatus: ManuscriptLifecycleStatus;
    reviewNote?: string | null;
  },
) {
  const status = taskStatusForManuscript(options.lifecycleStatus);
  const reviewed =
    status === TaskSubmissionStatus.REVISION_REQUIRED ||
    status === TaskSubmissionStatus.APPROVED ||
    status === TaskSubmissionStatus.REJECTED;
  const reviewedAt = reviewed ? new Date() : null;
  const attempts = await tx.taskSubmissionAttempt.findMany({
    where: { documentVersionId: options.documentVersionId },
    select: { id: true, taskSubmissionId: true },
  });
  if (!attempts.length) return [];
  await tx.taskSubmissionAttempt.updateMany({
    where: { id: { in: attempts.map(({ id }) => id) } },
    data: {
      status,
      reviewNote: options.reviewNote?.trim() || null,
      reviewedAt,
    },
  });
  await tx.taskSubmission.updateMany({
    where: { documentVersionId: options.documentVersionId },
    data: {
      status,
      reviewNote: options.reviewNote?.trim() || null,
      reviewedAt,
    },
  });
  return attempts;
}

function displayStatus(
  completed: boolean,
  statuses: TaskSubmissionStatus[],
  hasActivity: boolean,
): MilestoneDisplayStatus {
  if (completed) return "COMPLETED";
  if (statuses.includes(TaskSubmissionStatus.REVISION_REQUIRED))
    return "REVISION_REQUIRED";
  if (
    statuses.includes(TaskSubmissionStatus.UNDER_REVIEW) ||
    statuses.includes(TaskSubmissionStatus.SUBMITTED)
  )
    return "AWAITING_REVIEW";
  if (statuses.length && statuses.every((status) => status === "APPROVED"))
    return "APPROVED";
  return hasActivity ? "IN_PROGRESS" : "NOT_STARTED";
}

export function resolveAdviserMilestoneStatus(options: {
  hasEligibleAdviser: boolean;
  requestStatus?: string | null;
}): AdviserMilestoneStatus {
  if (options.hasEligibleAdviser) return "APPROVED";
  if (options.requestStatus === "PENDING") return "PENDING_ADVISER";
  if (options.requestStatus === "REJECTED") return "DECLINED";
  return "NOT_STARTED";
}

export async function getMilestoneProgress(
  client: DbClient,
  researchId: string,
) {
  const project = await client.researchProject.findUnique({
    where: { id: researchId },
    select: {
      defenseEligibilities: {
        select: { milestoneId: true, approvedAt: true, consumedAt: true },
      },
      programId: true,
      members: {
        where: { leftAt: null, projectRole: "ADVISER" },
        orderBy: { joinedAt: "desc" },
        select: {
          joinedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              programId: true,
              status: true,
              roles: {
                select: { role: { select: { name: true } } },
              },
            },
          },
        },
      },
      adviserRequests: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          workflowStageId: true,
          status: true,
          createdAt: true,
          respondedAt: true,
          responseNote: true,
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          adviser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      workflowInstance: {
        select: {
          currentStageId: true,
          completedAt: true,
          workflow: {
            select: {
              stages: {
                where: { category: { not: "Archived" } },
                orderBy: { sequence: "asc" },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  sequence: true,
                  requiresDocument: true,
                  requiresApproval: true,
                  milestoneType: true,
                  requiredMilestoneId: true,
                  isFinal: true,
                  tasks: {
                    orderBy: { sequence: "asc" },
                    select: {
                      id: true,
                      title: true,
                      sequence: true,
                      isRequired: true,
                      submissions: {
                        where: { researchId },
                        take: 1,
                        select: {
                          id: true,
                          status: true,
                          documentId: true,
                          documentVersionId: true,
                          submittedAt: true,
                          reviewedAt: true,
                          attempts: {
                            orderBy: { attemptNumber: "desc" },
                            select: {
                              id: true,
                              attemptNumber: true,
                              status: true,
                              documentVersionId: true,
                              submittedAt: true,
                              reviewedAt: true,
                            },
                          },
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
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const instance = project?.workflowInstance;
  if (!instance) return [];
  const progress = instance.workflow.stages.map((stage) => {
    const tasks = stage.tasks.map((task) => {
      const submission = task.submissions[0] || null;
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
      };
    });
    const requiredTasks = tasks.filter((task) => task.isRequired);
    const approvedRequiredTasks = requiredTasks.filter(
      (task) => task.status === TaskSubmissionStatus.APPROVED,
    ).length;
    const legacyApprovedDocument = requiredTasks.some(
      (task) =>
        task.status === TaskSubmissionStatus.APPROVED && task.documentId,
    );
    const approvedDocument =
      !stage.requiresDocument ||
      stage.submittedVersions.length > 0 ||
      legacyApprovedDocument;
    const totalRequirements =
      requiredTasks.length + (stage.requiresDocument ? 1 : 0);
    const completedRequirements =
      approvedRequiredTasks +
      (stage.requiresDocument && approvedDocument ? 1 : 0);
    const completed =
      totalRequirements > 0 && completedRequirements === totalRequirements;
    const statuses = tasks
      .map((task) => task.status)
      .filter(Boolean) as TaskSubmissionStatus[];
    const hasActivity =
      statuses.length > 0 ||
      tasks.some((task) => task.attempts.length > 0) ||
      stage.submittedVersions.length > 0;
    const activeAdviser =
      stage.milestoneType === "ADVISER_SELECTION"
        ? project.members.find(
            (member) =>
              member.user.status === "ACTIVE" &&
              member.user.programId === project.programId &&
              member.user.roles.some(({ role }) => role.name === "ADVISER"),
          ) || null
        : null;
    const stageRequests =
      stage.milestoneType === "ADVISER_SELECTION"
        ? project.adviserRequests.filter(
            (request) =>
              request.workflowStageId === stage.id ||
              request.workflowStageId === null,
          )
        : [];
    const adviserRequest =
      stageRequests.find((r) => r.status === "ACCEPTED") ||
      stageRequests.find((r) => r.status === "PENDING") ||
      stageRequests[0] ||
      null;
    const adviserMilestoneStatus: AdviserMilestoneStatus | null =
      stage.milestoneType !== "ADVISER_SELECTION"
        ? null
        : resolveAdviserMilestoneStatus({
            hasEligibleAdviser: Boolean(activeAdviser),
            requestStatus: adviserRequest?.status,
          });
    const defenseApproved = Boolean(
      project.defenseEligibilities?.some(
        (approval) => approval.milestoneId === stage.id,
      ),
    );
    const effectiveTotalRequirements =
      stage.milestoneType === "ADVISER_SELECTION"
        ? 1
        : totalRequirements +
          (stage.milestoneType === "DEFENSE_ELIGIBILITY" ? 1 : 0);
    const effectiveCompletedRequirements =
      stage.milestoneType === "ADVISER_SELECTION"
        ? activeAdviser
          ? 1
          : 0
        : completedRequirements +
          (stage.milestoneType === "DEFENSE_ELIGIBILITY" && defenseApproved
            ? 1
            : 0);
    const effectiveCompleted =
      stage.milestoneType === "DEFENSE_ELIGIBILITY"
        ? defenseApproved && (totalRequirements === 0 || completed)
        : stage.milestoneType === "ADVISER_SELECTION"
          ? Boolean(activeAdviser)
          : completed;
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      sequence: stage.sequence,
      requiresDocument: stage.requiresDocument,
      requiresApproval: stage.requiresApproval,
      milestoneType: stage.milestoneType,
      requiredMilestoneId: stage.requiredMilestoneId,
      isFinal: stage.isFinal,
      isCurrent: instance.currentStageId === stage.id,
      completed: effectiveCompleted,
      status:
        adviserMilestoneStatus ||
        displayStatus(effectiveCompleted, statuses, hasActivity),
      completionPercent:
        effectiveTotalRequirements > 0
          ? Math.round(
              (effectiveCompletedRequirements / effectiveTotalRequirements) *
                100,
            )
          : 0,
      completedRequirements: effectiveCompletedRequirements,
      totalRequirements: effectiveTotalRequirements,
      documentRequirementSatisfied: approvedDocument,
      adviserMilestone:
        stage.milestoneType === "ADVISER_SELECTION"
          ? {
              status: adviserMilestoneStatus,
              adviser: activeAdviser?.user || adviserRequest?.adviser || null,
              requestId: adviserRequest?.id || null,
              requestStatus: adviserRequest?.status || null,
              requestedAt: adviserRequest?.createdAt || null,
              respondedAt: adviserRequest?.respondedAt || null,
              acceptedAt:
                adviserRequest?.status === "ACCEPTED"
                  ? adviserRequest.respondedAt
                  : activeAdviser?.joinedAt || null,
              responseNote: adviserRequest?.responseNote || null,
              requestedBy: adviserRequest?.requestedBy || null,
              requestHistory: stageRequests.map((req) => ({
                id: req.id,
                status: req.status,
                createdAt: req.createdAt,
                respondedAt: req.respondedAt,
                responseNote: req.responseNote,
                adviser: req.adviser,
                requestedBy: req.requestedBy,
              })),
            }
          : null,
      tasks,
    };
  });
  const byId = new Map(progress.map((stage) => [stage.id, stage]));
  const satisfied = (id: string, visited = new Set<string>()): boolean => {
    if (visited.has(id)) return false;
    const stage = byId.get(id);
    if (!stage?.completed) return false;
    visited.add(id);
    return (
      !stage.requiredMilestoneId ||
      satisfied(stage.requiredMilestoneId, visited)
    );
  };
  return progress.map((stage) => {
    const required = stage.requiredMilestoneId
      ? byId.get(stage.requiredMilestoneId)
      : null;
    const conditionSatisfied =
      !stage.requiredMilestoneId || satisfied(stage.requiredMilestoneId);
    return {
      ...stage,
      requiredMilestone: required
        ? {
            id: required.id,
            name: required.name,
            completed: satisfied(required.id),
          }
        : null,
      requiredMilestoneSatisfied: conditionSatisfied,
      isBlocked: !conditionSatisfied,
      completed: stage.completed && conditionSatisfied,
      status: !conditionSatisfied ? ("BLOCKED" as const) : stage.status,
    };
  });
}

export async function advanceMilestoneIfSatisfied(
  tx: Prisma.TransactionClient,
  options: { researchId: string; milestoneId: string; actorId: string },
) {
  const progress = await getMilestoneProgress(tx, options.researchId);
  const changedMilestone = progress.find(
    ({ id }) => id === options.milestoneId,
  );
  const milestone = changedMilestone?.isCurrent
    ? changedMilestone
    : changedMilestone?.completed
      ? progress.find((stage) => stage.isCurrent && stage.completed)
      : null;
  if (!milestone?.completed || !milestone.isCurrent)
    return { advanced: false, completed: false, milestone };
  const instance = await tx.workflowInstance.findUnique({
    where: { researchId: options.researchId },
    include: { workflow: true },
  });
  if (!instance || instance.currentStageId !== milestone.id)
    return { advanced: false, completed: false, milestone };
  const completedMilestones: Array<{
    milestone: (typeof progress)[number];
    nextStage: (typeof progress)[number] | null;
  }> = [];
  let current = milestone;
  let nextStage: (typeof progress)[number] | undefined;
  let workflowCompleted = false;

  // A system-completed milestone, such as adviser selection, may already be
  // satisfied before it becomes current. Continue through consecutive
  // satisfied stages so the workflow never stops on an already-approved gate.
  while (current.completed) {
    nextStage = progress.find(
      (candidate) => candidate.sequence > current.sequence,
    );
    completedMilestones.push({
      milestone: current,
      nextStage: nextStage || null,
    });
    if (!nextStage) {
      const completedAt = new Date();
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: { completedAt },
      });
      await tx.researchProject.update({
        where: { id: options.researchId },
        data: { status: "COMPLETED", completedAt },
      });
      workflowCompleted = true;
      break;
    }
    await tx.workflowTransition.create({
      data: {
        workflowInstanceId: instance.id,
        fromStageId: current.id,
        toStageId: nextStage.id,
        performedBy: options.actorId,
        remarks: `All mandatory requirements for ${current.name} were satisfied.`,
      },
    });
    await tx.workflowInstance.update({
      where: { id: instance.id },
      data: { currentStageId: nextStage.id },
    });
    if (!nextStage.completed) break;
    current = nextStage;
  }
  const project = await tx.researchProject.findUnique({
    where: { id: options.researchId },
    select: {
      members: {
        where: { leftAt: null },
        select: { userId: true },
      },
      workflowInstance: {
        select: { workflow: { select: { createdBy: true } } },
      },
    },
  });
  const recipients = new Set(
    project?.members.map(({ userId }) => userId) || [],
  );
  if (project?.workflowInstance?.workflow.createdBy)
    recipients.add(project.workflowInstance.workflow.createdBy);
  await createNotificationsOnce(
    tx,
    completedMilestones.flatMap(
      ({ milestone: completedMilestone, nextStage: followingStage }) =>
        Array.from(recipients).map((recipientId) => ({
          recipientId,
          type: "WORKFLOW_CHANGED",
          title: "Milestone requirements completed",
          message: followingStage
            ? `${completedMilestone.name} is complete. The project can continue to ${followingStage.name}.`
            : `${completedMilestone.name} and all configured project requirements are complete.`,
          entityType: "WorkflowStage",
          entityId: completedMilestone.id,
          actionUrl: `/research/manuscript?projectId=${options.researchId}&milestoneId=${completedMilestone.id}`,
          deduplicationKey: `milestone:${options.researchId}:${completedMilestone.id}:completed:${recipientId}`,
        })),
    ),
  );
  return {
    advanced: true,
    completed: workflowCompleted,
    nextStageName: workflowCompleted ? undefined : nextStage?.name,
    milestone,
  };
}

export async function getManuscriptActivity(
  client: DbClient,
  researchId: string,
  exposeFacultyIdentity: boolean,
) {
  const documents = await client.document.findMany({
    where: { researchId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      createdBy: true,
      versions: { select: { id: true, versionNumber: true } },
      manuscriptStatusEvents: {
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
          version: { select: { id: true, versionNumber: true } },
        },
      },
      reviewerAssignments: {
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true },
          },
          events: {
            include: {
              actor: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          documentVersion: { select: { id: true, versionNumber: true } },
          review: {
            select: { id: true, recommendation: true, submittedAt: true },
          },
        },
      },
      officialCopies: {
        include: {
          finalizedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          signatures: {
            include: {
              signedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });
  const workflowTransitions = await client.workflowTransition.findMany({
    where: { workflowInstance: { researchId } },
    include: {
      fromStage: { select: { id: true, name: true } },
      toStage: { select: { id: true, name: true } },
      performedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  const taskAttempts = await client.taskSubmissionAttempt.findMany({
    where: { researchId },
    include: {
      task: { select: { id: true, title: true } },
      documentVersion: { select: { id: true, versionNumber: true } },
      submittedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  const defenseSessions = await client.defenseSession.findMany({
    where: { researchId },
    select: {
      id: true,
      status: true,
      decision: true,
      scheduledStart: true,
      startedAt: true,
      endedAt: true,
      releasedAt: true,
      createdAt: true,
      packet: {
        select: {
          id: true,
          status: true,
          publishedAt: true,
          manuscriptVersionId: true,
        },
      },
    },
  });
  const consultations = await client.consultation.findMany({
    where: { researchId },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledStart: true,
      createdAt: true,
      updatedAt: true,
      notes: { select: { id: true, createdAt: true } },
    },
  });
  const creatorIds = Array.from(
    new Set(documents.map(({ createdBy }) => createdBy)),
  );
  const creators = await client.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
  const activity: Array<Record<string, unknown> & { timestamp: Date }> = [];
  const actor = (
    value: { id: string; firstName: string; lastName: string } | undefined,
    faculty = false,
  ) =>
    faculty && !exposeFacultyIdentity
      ? { id: null, name: "Assigned faculty" }
      : {
          id: value?.id || null,
          name: value ? `${value.firstName} ${value.lastName}` : "Advisio user",
        };
  for (const document of documents) {
    activity.push({
      id: `document:${document.id}:created`,
      type: "DOCUMENT_CREATED",
      title: "Document created",
      description: document.title,
      timestamp: document.createdAt,
      documentId: document.id,
      versionId: null,
      actor: actor(creatorMap.get(document.createdBy)),
    });
    for (const event of document.manuscriptStatusEvents) {
      const titles: Record<string, string> = {
        SUBMITTED:
          (event.version?.versionNumber || 1) > 1
            ? "New manuscript version submitted"
            : "Manuscript submitted",
        IN_REVIEW: "Review started",
        REVISION_REQUIRED: "Revision requested",
        APPROVED: "Manuscript approved",
        FINALIZED: "Manuscript finalized",
      };
      activity.push({
        id: `lifecycle:${event.id}`,
        type: event.toStatus,
        title: titles[event.toStatus] || "Manuscript status changed",
        description:
          event.toStatus === "REVISION_REQUIRED"
            ? event.reason || "Revisions were requested."
            : `${document.title}${event.version ? ` · Version ${event.version.versionNumber}` : ""}`,
        timestamp: event.createdAt,
        documentId: document.id,
        versionId: event.versionId,
        actor: actor(
          event.actor,
          !["SUBMITTED", "DRAFT"].includes(event.toStatus),
        ),
      });
    }
    for (const assignment of document.reviewerAssignments) {
      for (const event of assignment.events) {
        if (!["ASSIGNED", "REASSIGNED"].includes(event.action)) continue;
        activity.push({
          id: `assignment:${event.id}`,
          type: "REVIEWER_ASSIGNED",
          title:
            event.action === "REASSIGNED"
              ? "Reviewer assignment updated"
              : "Reviewer assigned",
          description: `${document.title} · Version ${assignment.documentVersion.versionNumber}`,
          timestamp: event.createdAt,
          documentId: document.id,
          versionId: assignment.documentVersionId,
          actor: actor(event.actor, true),
        });
      }
      if (assignment.review?.submittedAt) {
        activity.push({
          id: `review:${assignment.review.id}`,
          type: "REVIEW_DECISION",
          title: "Review decision recorded",
          description: assignment.review.recommendation
            ? assignment.review.recommendation.replace(/_/g, " ").toLowerCase()
            : "Faculty review completed",
          timestamp: assignment.review.submittedAt,
          documentId: document.id,
          versionId: assignment.documentVersionId,
          actor: exposeFacultyIdentity
            ? actor(assignment.reviewer)
            : { id: null, name: "Assigned faculty" },
        });
      }
    }
    for (const copy of document.officialCopies) {
      activity.push({
        id: `official-copy:${copy.id}`,
        type:
          copy.status === "REVOKED"
            ? "OFFICIAL_COPY_REVOKED"
            : copy.status === "SUPERSEDED"
              ? "OFFICIAL_COPY_SUPERSEDED"
              : "OFFICIAL_COPY_FINALIZED",
        title:
          copy.status === "REVOKED"
            ? "Official copy revoked"
            : copy.status === "SUPERSEDED"
              ? "Official copy superseded"
              : "Official copy archived",
        description: `${document.title} · Version ${document.versions.find(({ id }) => id === copy.sourceVersionId)?.versionNumber || "approved"}`,
        timestamp: copy.finalizedAt,
        documentId: document.id,
        versionId: copy.sourceVersionId,
        actor: actor(copy.finalizedBy, true),
      });
      for (const signature of copy.signatures) {
        activity.push({
          id: `official-signature:${signature.id}`,
          type: "OFFICIAL_COPY_SIGNED",
          title: "Official copy visually signed",
          description:
            "An authorized account added a visual signature to a separate official PDF artifact.",
          timestamp: signature.signedAt,
          documentId: document.id,
          versionId: copy.sourceVersionId,
          actor: actor(signature.signedBy, true),
        });
      }
    }
  }
  for (const attempt of taskAttempts) {
    activity.push({
      id: `task-attempt:${attempt.id}`,
      type: "TASK_SUBMISSION",
      title:
        attempt.attemptNumber > 1
          ? "Task revision submitted"
          : "Task requirement submitted",
      description: `${attempt.task.title} · Version ${attempt.documentVersion.versionNumber}`,
      timestamp: attempt.submittedAt,
      documentId: attempt.documentId,
      versionId: attempt.documentVersionId,
      milestoneId: attempt.milestoneId,
      actor: actor(attempt.submittedByUser),
    });
    if (attempt.reviewedAt) {
      activity.push({
        id: `task-attempt:${attempt.id}:decision`,
        type:
          attempt.status === "APPROVED"
            ? "MILESTONE_REQUIREMENT_APPROVED"
            : attempt.status === "REVISION_REQUIRED"
              ? "REVISION_REQUIRED"
              : "TASK_REVIEWED",
        title:
          attempt.status === "APPROVED"
            ? "Milestone requirement approved"
            : attempt.status === "REVISION_REQUIRED"
              ? "Revision requested"
              : "Task submission reviewed",
        description: attempt.task.title,
        timestamp: attempt.reviewedAt,
        documentId: attempt.documentId,
        versionId: attempt.documentVersionId,
        milestoneId: attempt.milestoneId,
        actor: { id: null, name: "Assigned faculty" },
      });
    }
  }
  for (const transition of workflowTransitions) {
    activity.push({
      id: `workflow:${transition.id}`,
      type: "MILESTONE_COMPLETED",
      title: transition.fromStage
        ? `${transition.fromStage.name} completed`
        : "Workflow milestone changed",
      description: `Project advanced to ${transition.toStage.name}.`,
      timestamp: transition.createdAt,
      documentId: null,
      versionId: null,
      milestoneId: transition.fromStageId,
      actor: actor(transition.performedByUser, true),
    });
  }
  for (const session of defenseSessions) {
    activity.push({
      id: `defense:${session.id}:scheduled`,
      type: "DEFENSE_SCHEDULED",
      title: "Defense session scheduled",
      description: session.scheduledStart
        ? `Scheduled for ${session.scheduledStart.toISOString()}`
        : "The project was added to a defense session.",
      timestamp: session.createdAt,
      defenseSessionId: session.id,
      actor: { id: null, name: "Defense coordinator" },
    });
    if (session.packet?.status === "PUBLISHED" && session.packet.publishedAt) {
      activity.push({
        id: `defense-packet:${session.packet.id}:published`,
        type: "DEFENSE_PACKET_PUBLISHED",
        title: "Defense manuscript packet published",
        description:
          "The approved manuscript version was published for the defense session.",
        timestamp: session.packet.publishedAt,
        defenseSessionId: session.id,
        versionId: session.packet.manuscriptVersionId,
        actor: { id: null, name: "Defense coordinator" },
      });
    }
    if (session.startedAt)
      activity.push({
        id: `defense:${session.id}:started`,
        type: "DEFENSE_STARTED",
        title: "Defense started",
        description: "The scheduled defense session began.",
        timestamp: session.startedAt,
        defenseSessionId: session.id,
        actor: { id: null, name: "Defense coordinator" },
      });
    if (session.endedAt)
      activity.push({
        id: `defense:${session.id}:ended`,
        type: "DEFENSE_COMPLETED",
        title: "Defense session completed",
        description: "The defense session was concluded.",
        timestamp: session.endedAt,
        defenseSessionId: session.id,
        actor: { id: null, name: "Defense coordinator" },
      });
    if (session.releasedAt)
      activity.push({
        id: `defense:${session.id}:released`,
        type: "DEFENSE_RESULT_RELEASED",
        title: "Defense result released",
        description: session.decision
          ? session.decision.replace(/_/g, " ").toLowerCase()
          : "The official defense result was released.",
        timestamp: session.releasedAt,
        defenseSessionId: session.id,
        actor: { id: null, name: "Defense coordinator" },
      });
  }
  for (const consultation of consultations) {
    activity.push({
      id: `consultation:${consultation.id}:scheduled`,
      type: "CONSULTATION_SCHEDULED",
      title: "Consultation scheduled",
      description: `${consultation.title} · ${consultation.scheduledStart.toISOString()}`,
      timestamp: consultation.createdAt,
      consultationId: consultation.id,
      actor: { id: null, name: "Project member" },
    });
    if (consultation.status === "COMPLETED")
      activity.push({
        id: `consultation:${consultation.id}:completed`,
        type: "CONSULTATION_COMPLETED",
        title: "Consultation completed",
        description: consultation.title,
        timestamp: consultation.updatedAt,
        consultationId: consultation.id,
        actor: { id: null, name: "Project member" },
      });
    for (const note of consultation.notes)
      activity.push({
        id: `consultation-note:${note.id}`,
        type: "CONSULTATION_NOTE_ADDED",
        title: "Consultation notes recorded",
        description: consultation.title,
        timestamp: note.createdAt,
        consultationId: consultation.id,
        actor: { id: null, name: "Authorized participant" },
      });
  }
  return activity.sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
}
