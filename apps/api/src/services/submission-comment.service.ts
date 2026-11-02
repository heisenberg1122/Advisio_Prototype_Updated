import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { hasActiveWorkflowEnrollment } from "./workflow-enrollment-access.service.js";
import { canReviewTaskSubmission } from "./task-submission-access.service.js";

export class SubmissionCommentError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export const commentVersionSchema = z.string().uuid();
const highlightRectSchema = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
  })
  .refine(
    (rect) => rect.x + rect.width <= 1.00001 && rect.y + rect.height <= 1.00001,
    "Highlight must stay within the page.",
  );
export const submissionTextAnchorSchema = z.object({
  pageNumber: z.number().int().min(1).max(100000),
  selectedText: z.string().trim().min(1).max(5000),
  rects: z.array(highlightRectSchema).min(1).max(100),
});
export const submissionCommentSchema = z
  .object({
    documentVersionId: commentVersionSchema,
    body: z.string().trim().min(1).max(2000),
    pageNumber: z.number().int().min(1).max(100000).nullable().optional(),
    textAnchor: submissionTextAnchorSchema.optional(),
  })
  .refine(
    (data) =>
      !data.textAnchor ||
      data.pageNumber == null ||
      data.pageNumber === data.textAnchor.pageNumber,
    "The comment and highlight must reference the same page.",
  );

export async function assertSubmissionCommentAccess(
  submissionId: string,
  versionId: string,
  user: AuthenticatedUser,
  writing: boolean,
) {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: {
      task: {
        include: { stage: { include: { workflow: true, responsible: true } } },
      },
      research: { include: { members: { where: { leftAt: null } } } },
      attempts: { select: { documentVersionId: true } },
    },
  });
  if (!submission)
    throw new SubmissionCommentError("Submission not found.", 404);
  if (
    !user.roles.includes("SYSTEM_ADMIN") &&
    user.collegeId !== submission.research.collegeId
  )
    throw new SubmissionCommentError(
      "Switch to this submission's authorized college before opening its comments, grade, or history.",
      403,
    );
  if (
    versionId !== submission.documentVersionId &&
    !submission.attempts.some((a) => a.documentVersionId === versionId)
  )
    throw new SubmissionCommentError(
      "This version was not submitted for this requirement.",
      404,
    );

  const stage = submission.task.stage;
  const member = submission.research.members.some(
    (m) => m.userId === user.id && ["LEADER", "MEMBER"].includes(m.projectRole),
  );
  // Enrollment and project membership must both still be active. A removed
  // participant must not regain workflow access through an old comment link.
  if (member && (await hasActiveWorkflowEnrollment(user.id, stage.workflowId)))
    return true;
  if (!user.researcherPanel) {
    if (
      canReviewTaskSubmission(user, {
        submittedBy: submission.submittedBy,
        researchCollegeId: submission.research.collegeId,
        workflowOwnerId: stage.workflow.createdBy,
        responsibleRole: stage.responsible.name,
      })
    )
      return true;
    const assignment = await prisma.reviewerAssignment.findFirst({
      where: {
        documentVersionId: versionId,
        reviewerId: user.id,
        status: { in: writing ? ["ACTIVE"] : ["ACTIVE", "COMPLETED"] },
      },
      select: { id: true, status: true },
    });
    if (assignment) return assignment.status === "ACTIVE";
  }
  throw new SubmissionCommentError(
    "You do not have access to this submission's comments.",
    403,
  );
}

const commentSelect = {
  id: true,
  body: true,
  pageNumber: true,
  textAnchor: true,
  createdAt: true,
  documentVersionId: true,
  author: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function listSubmissionComments(
  submissionId: string,
  versionId: string,
  user: AuthenticatedUser,
  cursor?: string,
) {
  const canComment = await assertSubmissionCommentAccess(
    submissionId,
    versionId,
    user,
    false,
  );
  const comments = await prisma.taskSubmissionComment.findMany({
    where: { taskSubmissionId: submissionId, documentVersionId: versionId },
    select: commentSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    comments: comments.slice(0, 50),
    nextCursor: comments.length > 50 ? comments[49].id : null,
    canComment,
  };
}

export async function postSubmissionComment(
  submissionId: string,
  input: z.infer<typeof submissionCommentSchema>,
  user: AuthenticatedUser,
) {
  const data = submissionCommentSchema.parse(input);
  await assertSubmissionCommentAccess(
    submissionId,
    data.documentVersionId,
    user,
    true,
  );
  // Comments are shared conversation, independent of permanent review decisions.
  // They never change submission status, manuscript bytes, or workflow progress.
  return prisma.taskSubmissionComment.create({
    data: {
      taskSubmissionId: submissionId,
      authorId: user.id,
      ...data,
      ...(data.textAnchor ? { pageNumber: data.textAnchor.pageNumber } : {}),
    },
    select: commentSelect,
  });
}
