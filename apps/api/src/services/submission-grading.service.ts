import { z } from "zod";
import { Permissions } from "@research-management/auth";
import { Prisma, prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  assertSubmissionCommentAccess,
  SubmissionCommentError,
} from "./submission-comment.service.js";

export class SubmissionGradingError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export const maxPointsSchema = z.number().int().min(1).max(10000).nullable();
export const gradeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SAVE_DRAFT"),
    documentVersionId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    score: z
      .number()
      .finite()
      .min(0)
      .max(10000)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
        "Use at most two decimal places.",
      ),
  }),
  z.object({
    action: z.literal("RELEASE"),
    documentVersionId: z.string().uuid(),
    expectedRevision: z.number().int().min(1),
  }),
]);
type Db = Prisma.TransactionClient | typeof prisma;
const person = { id: true, firstName: true, lastName: true } as const;
const contextInclude = {
  task: { include: { stage: { include: { workflow: true } } } },
  research: {
    select: {
      collegeId: true,
      workflowInstance: { select: { workflowId: true } },
    },
  },
} as const;
function canGrade(user: AuthenticatedUser, submission: any) {
  return (
    !user.researcherPanel &&
    user.id !== submission.submittedBy &&
    user.roles.includes("RESEARCH_COORDINATOR") &&
    user.permissions.includes(Permissions.WORKFLOW_EDIT) &&
    submission.task.stage.workflow.createdBy === user.id &&
    submission.research.workflowInstance?.workflowId ===
      submission.task.stage.workflowId &&
    user.collegeId === submission.research.collegeId
  );
}
function gradeResponse(grade: any, allowDraft: boolean) {
  if (!grade) return null;
  return {
    maxPoints: grade.maxPoints,
    releasedScore:
      grade.releasedScore == null ? null : Number(grade.releasedScore),
    releasedAt: grade.releasedAt,
    releasedBy: grade.releasedBy || null,
    ...(allowDraft
      ? {
          draftScore:
            grade.draftScore == null ? null : Number(grade.draftScore),
          revision: grade.revision,
          updatedAt: grade.updatedAt,
          updatedBy: grade.updatedBy,
          draftSavedAt: grade.events?.[0]?.createdAt || grade.createdAt,
          draftSavedBy: grade.events?.[0]?.actor || grade.updatedBy,
        }
      : {}),
  };
}
export async function getSubmissionGrade(
  submissionId: string,
  versionId: string,
  user: AuthenticatedUser,
) {
  await assertSubmissionCommentAccess(submissionId, versionId, user, false);
  const submission = await prisma.taskSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      ...contextInclude,
      attempts: {
        where: { documentVersionId: versionId },
        select: { submittedAt: true, submittedByUser: { select: person } },
      },
      submittedByUser: { select: person },
    },
  });
  const owner = canGrade(user, submission);
  const grade = await prisma.taskSubmissionGrade.findUnique({
    where: {
      taskSubmissionId_documentVersionId: {
        taskSubmissionId: submissionId,
        documentVersionId: versionId,
      },
    },
    include: { releasedBy: { select: person }, updatedBy: { select: person }, ...(owner ? { events: { where: { action: "DRAFT_SAVED" }, orderBy: { createdAt: "desc" as const }, take: 1, select: { createdAt: true, actor: { select: person } } } } : {}) },
  });
  // Researchers cannot distinguish an unreleased private draft from no grade.
  return {
    maxPoints: grade?.maxPoints ?? submission.task.maxPoints,
    canGrade: owner && versionId === submission.documentVersionId,
    grade:
      grade && (owner || grade.releasedAt) ? gradeResponse(grade, owner) : null,
    submittedAt: submission.attempts[0]?.submittedAt || submission.submittedAt,
    submittedBy:
      submission.attempts[0]?.submittedByUser || submission.submittedByUser,
  };
}

export async function saveSubmissionGrade(
  submissionId: string,
  input: z.infer<typeof gradeActionSchema>,
  user: AuthenticatedUser,
) {
  const action = gradeActionSchema.parse(input);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const submission = await tx.taskSubmission.findUnique({
          where: { id: submissionId },
          include: contextInclude,
        });
        if (!submission)
          throw new SubmissionGradingError("Submission not found.", 404);
        if (!canGrade(user, submission))
          throw new SubmissionGradingError(
            "Only this workflow's professor can grade this submission.",
            403,
          );
        if (submission.documentVersionId !== action.documentVersionId)
          throw new SubmissionGradingError(
            "This submission changed. Open the current submitted version before grading.",
            409,
          );
        const points = submission.task.maxPoints;
        if (points == null)
          throw new SubmissionGradingError(
            "This requirement is ungraded. Set its points in the milestone first.",
            409,
          );
        const existing = await tx.taskSubmissionGrade.findUnique({
          where: {
            taskSubmissionId_documentVersionId: {
              taskSubmissionId: submissionId,
              documentVersionId: action.documentVersionId,
            },
          },
        });
        if ((existing?.revision || 0) !== action.expectedRevision)
          throw new SubmissionGradingError(
            "The grade changed in another session. Reload it before saving.",
            409,
          );
        const maxPoints = existing?.maxPoints ?? points;
        const score =
          action.action === "SAVE_DRAFT"
            ? action.score
            : existing?.draftScore == null
              ? null
              : Number(existing.draftScore);
        if (score == null)
          throw new SubmissionGradingError(
            "Save a draft grade before releasing it.",
          );
        if (score > maxPoints)
          throw new SubmissionGradingError(
            `The score cannot exceed ${maxPoints} points.`,
          );
        if (
          action.action === "RELEASE" &&
          existing?.releasedScore != null &&
          Number(existing.releasedScore) === score
        )
          return gradeResponse(existing, true);
        const now = new Date();
        const data = {
          updatedById: user.id,
          revision: (existing?.revision || 0) + 1,
          ...(action.action === "SAVE_DRAFT"
            ? { draftScore: score }
            : { releasedScore: score, releasedAt: now, releasedById: user.id }),
        };
        const grade = existing
          ? await tx.taskSubmissionGrade.update({
              where: { id: existing.id },
              data,
            })
          : await tx.taskSubmissionGrade.create({
              data: {
                taskSubmissionId: submissionId,
                documentVersionId: action.documentVersionId,
                maxPoints,
                draftScore: score,
                ...data,
              },
            });
        await tx.taskSubmissionGradeEvent.create({
          data: {
            gradeId: grade.id,
            actorId: user.id,
            action:
              action.action === "SAVE_DRAFT" ? "DRAFT_SAVED" : "GRADE_RELEASED",
            score,
            maxPoints,
          },
        });
        return gradeResponse(grade, true);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: any) {
    if (["P2034", "P2002"].includes(error.code))
      throw new SubmissionGradingError(
        "The submission or grade changed in another session. Reload before trying again.",
        409,
      );
    throw error;
  }
}

export async function setRequirementPoints(
  taskId: string,
  value: number | null,
  user: AuthenticatedUser,
) {
  const maxPoints = maxPointsSchema.parse(value);
  return prisma.$transaction(
    async (tx) => {
      const task = await tx.workflowTask.findUnique({
        where: { id: taskId },
        include: { stage: { include: { workflow: true } } },
      });
      if (!task)
        throw new SubmissionGradingError("Requirement not found.", 404);
      if (
        user.researcherPanel ||
        !user.roles.includes("RESEARCH_COORDINATOR") ||
        !user.permissions.includes(Permissions.WORKFLOW_EDIT) ||
        task.stage.workflow.createdBy !== user.id
      )
        throw new SubmissionGradingError(
          "Only the workflow's professor can configure grading.",
          403,
        );
      if (
        !task.stage.requiresDocument ||
        task.stage.milestoneType !== "STANDARD"
      )
        throw new SubmissionGradingError(
          "Grading is available for standard submission requirements only.",
        );
      if (task.maxPoints === maxPoints) return { task };
      if (
        await tx.taskSubmissionGrade.count({
          where: { submission: { taskId } },
        })
      )
        throw new SubmissionGradingError(
          "Points are locked after grading begins to preserve recorded grades.",
          409,
        );
      const updated = await tx.workflowTask.update({
        where: { id: taskId },
        data: { maxPoints },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entityType: "WorkflowTaskGrading",
          entityId: taskId,
          oldValues: { maxPoints: task.maxPoints },
          newValues: { maxPoints },
        },
      });
      return { task: updated };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submissionHistory(
  submissionId: string,
  versionId: string,
  user: AuthenticatedUser,
) {
  await assertSubmissionCommentAccess(submissionId, versionId, user, false);
  const submission = await prisma.taskSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      ...contextInclude,
      attempts: {
        include: {
          submittedByUser: { select: person },
          documentVersion: { select: { versionNumber: true } },
        },
        orderBy: { attemptNumber: "asc" },
      },
      submittedByUser: { select: person },
    },
  });
  const owner = canGrade(user, submission);
  const accessible = new Set<string>([versionId]);
  for (const attempt of submission.attempts) {
    if (accessible.has(attempt.documentVersionId)) continue;
    try {
      await assertSubmissionCommentAccess(
        submissionId,
        attempt.documentVersionId,
        user,
        false,
      );
      accessible.add(attempt.documentVersionId);
    } catch (error) {
      if (
        !(
          error instanceof SubmissionCommentError &&
          [403, 404].includes(error.statusCode)
        )
      )
        throw error;
    }
  }
  const ids = [...accessible];
  const [reviews, comments, grades] = await Promise.all([
    prisma.review.findMany({
      where: {
        documentVersionId: { in: ids },
        status: "SUBMITTED",
        ...(!owner ? { reviewerId: user.id } : {}),
      },
      select: {
        id: true,
        documentVersionId: true,
        recommendation: true,
        submittedAt: true,
        reviewer: { select: person },
      },
    }),
    prisma.taskSubmissionComment.findMany({
      where: { taskSubmissionId: submissionId, documentVersionId: { in: ids } },
      select: {
        id: true,
        documentVersionId: true,
        createdAt: true,
        pageNumber: true,
        author: { select: person },
      },
    }),
    prisma.taskSubmissionGradeEvent.findMany({
      where: {
        grade: {
          taskSubmissionId: submissionId,
          documentVersionId: { in: ids },
        },
        ...(!owner ? { action: "GRADE_RELEASED" } : {}),
      },
      include: {
        actor: { select: person },
        grade: { select: { documentVersionId: true } },
      },
    }),
  ]);
  type Entry = {
    id: string;
    action: string;
    at: Date | null;
    actor: { id: string; firstName: string; lastName: string } | null;
    versionId: string;
    detail?: string;
  };
  const events: Entry[] = submission.attempts
    .filter((attempt) => accessible.has(attempt.documentVersionId))
    .map((attempt) => ({
      id: `attempt:${attempt.id}`,
      action: attempt.attemptNumber > 1 ? "Resubmitted" : "Turned in",
      at: attempt.submittedAt,
      actor: attempt.submittedByUser,
      versionId: attempt.documentVersionId,
      detail: `Attempt ${attempt.attemptNumber} · Version ${attempt.documentVersion.versionNumber}`,
    }));
  if (!events.length)
    events.push({
      id: `submission:${submission.id}`,
      action: "Turned in",
      at: submission.submittedAt,
      actor: submission.submittedByUser,
      versionId,
    });
  for (const review of reviews)
    events.push({
      id: `review:${review.id}`,
      action:
        review.recommendation === "APPROVE"
          ? "Approved"
          : review.recommendation === "REJECT"
            ? "Rejected"
            : "Revision requested",
      at: review.submittedAt,
      actor: review.reviewer,
      versionId: review.documentVersionId,
    });
  for (const attempt of submission.attempts)
    if (
      accessible.has(attempt.documentVersionId) &&
      attempt.reviewedAt &&
      !reviews.some(
        (review) => review.documentVersionId === attempt.documentVersionId,
      )
    )
      events.push({
        id: `legacy-review:${attempt.id}`,
        action: attempt.status.replace(/_/g, " ").toLowerCase(),
        at: attempt.reviewedAt,
        actor: null,
        versionId: attempt.documentVersionId,
      });
  for (const comment of comments)
    events.push({
      id: `comment:${comment.id}`,
      action: "Comment posted",
      at: comment.createdAt,
      actor: comment.author,
      versionId: comment.documentVersionId,
      detail: comment.pageNumber ? `Page ${comment.pageNumber}` : undefined,
    });
  for (const event of grades)
    events.push({
      id: event.id,
      action:
        event.action === "DRAFT_SAVED" ? "Draft grade saved" : "Grade released",
      at: event.createdAt,
      actor: event.actor,
      versionId: event.grade.documentVersionId,
      detail: `${Number(event.score)}/${event.maxPoints}`,
    });
  return {
    events: events
      .filter((event) => event.at)
      .sort((a, b) => b.at!.getTime() - a.at!.getTime()),
  };
}
