import { assertMilestoneAvailable, lockMilestoneProject } from "./milestone-eligibility.service.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  ManuscriptLifecycleStatus,
  Prisma,
  ReviewRecommendation,
  ReviewType,
  prisma,
} from "../lib/prisma.js";
import {
  advanceMilestoneIfSatisfied,
  createNotificationsOnce,
  synchronizeTaskAttemptLifecycle,
} from "./research-workflow-integration.service.js";

type TransactionClient = Prisma.TransactionClient;

export class ReviewerAssignmentError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "REVIEWER_ASSIGNMENT_ERROR",
  ) {
    super(message);
    this.name = "ReviewerAssignmentError";
  }
}

const reviewerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const assignmentInclude = {
  reviewer: { select: reviewerSelect },
  assignedBy: { select: reviewerSelect },
  review: { include: { comments: { orderBy: { createdAt: "asc" as const } } } },
  document: { select: { id: true, title: true, lifecycleStatus: true } },
  documentVersion: {
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      submittedAt: true,
      contentChecksum: true,
      manuscriptStatus: true,
      googleDriveFileId: true,
      milestone: { select: { id: true, name: true, sequence: true } },
    },
  },
  research: { select: { id: true, title: true, groupName: true } },
  events: {
    include: { actor: { select: reviewerSelect } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function reviewTypeForRole(role: string): ReviewType | null {
  if (role === "ADVISER") return ReviewType.ADVISER;
  if (role === "RESEARCH_COORDINATOR") return ReviewType.COORDINATOR;
  if (role === "PANELIST") return ReviewType.PANEL;
  if (role === "REB") return ReviewType.REB;
  if (role === "RPO" || role === "VPAA") return ReviewType.DEAN;
  return null;
}

async function workflowAuthority(
  client: TransactionClient | typeof prisma,
  researchId: string,
  user: AuthenticatedUser,
) {
  const project = await client.researchProject.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      collegeId: true,
      workflowInstance: {
        select: { workflow: { select: { createdBy: true } } },
      },
    },
  });
  if (!project)
    throw new ReviewerAssignmentError(
      "Research project not found.",
      404,
      "PROJECT_NOT_FOUND",
    );
  if (
    !user.roles.includes("RESEARCH_COORDINATOR") ||
    project.workflowInstance?.workflow.createdBy !== user.id
  ) {
    throw new ReviewerAssignmentError(
      "Only the professor who owns this project's assigned workflow can manage manuscript reviewers.",
      403,
      "ASSIGNMENT_AUTHORITY_REQUIRED",
    );
  }
  return project;
}

async function validateReviewer(
  client: TransactionClient | typeof prisma,
  researchId: string,
  reviewerId: string,
  reviewType: ReviewType,
) {
  const project = await client.researchProject.findUnique({
    where: { id: researchId },
    select: {
      collegeId: true,
      workflowInstance: {
        select: { workflow: { select: { createdBy: true } } },
      },
      members: {
        where: { userId: reviewerId, leftAt: null },
        select: { projectRole: true },
      },
      defenseSessions: {
        where: {
          invitations: {
            some: {
              inviteeId: reviewerId,
              status: "ACCEPTED",
              role: { in: ["PANELIST", "PANEL_CHAIR"] },
            },
          },
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  const reviewer = await client.user.findUnique({
    where: { id: reviewerId },
    select: {
      id: true,
      status: true,
      collegeId: true,
      firstName: true,
      lastName: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!project || !reviewer || reviewer.status !== "ACTIVE")
    throw new ReviewerAssignmentError(
      "The selected reviewer is unavailable.",
      400,
      "REVIEWER_UNAVAILABLE",
    );

  const roles = reviewer.roles.map(({ role }) => role.name);
  const projectRoles = project.members.map(({ projectRole }) => projectRole);
  if (projectRoles.includes("LEADER") || projectRoles.includes("MEMBER")) {
    throw new ReviewerAssignmentError(
      "Student research-group members cannot review or approve their own manuscript.",
      403,
      "STUDENT_SELF_APPROVAL_FORBIDDEN",
    );
  }

  const eligible =
    (reviewType === ReviewType.ADVISER &&
      roles.includes("ADVISER") &&
      projectRoles.includes("ADVISER")) ||
    (reviewType === ReviewType.COORDINATOR &&
      roles.includes("RESEARCH_COORDINATOR") &&
      project.workflowInstance?.workflow.createdBy === reviewer.id) ||
    (reviewType === ReviewType.PANEL &&
      roles.includes("PANELIST") &&
      (projectRoles.includes("PANELIST") || project.defenseSessions.length > 0)) ||
    (reviewType === ReviewType.REB &&
      roles.includes("REB") &&
      reviewer.collegeId === project.collegeId) ||
    (reviewType === ReviewType.DEAN &&
      (roles.includes("VPAA") ||
        (roles.includes("RPO") && reviewer.collegeId === project.collegeId)));
  if (!eligible) {
    throw new ReviewerAssignmentError(
      "The selected faculty member does not have the required project-scoped reviewer relationship.",
      403,
      "REVIEWER_SCOPE_REQUIRED",
    );
  }
  return reviewer;
}

async function transitionToInReview(
  tx: TransactionClient,
  documentId: string,
  versionId: string,
  actorId: string,
) {
  const changed = await tx.document.updateMany({
    where: {
      id: documentId,
      lifecycleStatus: ManuscriptLifecycleStatus.SUBMITTED,
    },
    data: { lifecycleStatus: ManuscriptLifecycleStatus.IN_REVIEW },
  });
  if (!changed.count) return false;
  await tx.documentVersion.update({
    where: { id: versionId },
    data: { manuscriptStatus: ManuscriptLifecycleStatus.IN_REVIEW },
  });
  await tx.manuscriptStatusEvent.create({
    data: {
      documentId,
      versionId,
      fromStatus: ManuscriptLifecycleStatus.SUBMITTED,
      toStatus: ManuscriptLifecycleStatus.IN_REVIEW,
      actorId,
      reason: "Required manuscript reviewers were assigned.",
    },
  });
  return true;
}

export async function createConfiguredAssignmentsForSubmission(
  tx: TransactionClient,
  options: {
    researchId: string;
    documentId: string;
    versionId: string;
    milestoneId: string;
  },
) {
  const context = await tx.researchProject.findUnique({
    where: { id: options.researchId },
    select: {
      members: {
        where: { leftAt: null, projectRole: "ADVISER" },
        select: {
          userId: true,
          user: {
            select: {
              status: true,
              roles: { select: { role: { select: { name: true } } } },
            },
          },
        },
      },
      workflowInstance: {
        select: {
          workflow: {
            select: {
              createdBy: true,
              creator: {
                select: {
                  status: true,
                  roles: { select: { role: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  const milestone = await tx.workflowStage.findUnique({
    where: { id: options.milestoneId },
    select: { requiresApproval: true },
  });
  const workflow = context?.workflowInstance?.workflow;
  if (!context || !milestone?.requiresApproval || !workflow) return [];
  const professorIsEligible =
    workflow.creator.status === "ACTIVE" &&
    workflow.creator.roles.some(
      ({ role }) => role.name === "RESEARCH_COORDINATOR",
    );
  if (!professorIsEligible) return [];

  const candidates: Array<{ reviewerId: string; reviewType: ReviewType }> = [];
  const seen = new Set<string>();
  for (const member of context.members) {
    if (
      member.user.status === "ACTIVE" &&
      member.user.roles.some(({ role }) => role.name === "ADVISER") &&
      !seen.has(member.userId)
    ) {
      candidates.push({
        reviewerId: member.userId,
        reviewType: ReviewType.ADVISER,
      });
      seen.add(member.userId);
    }
  }
  if (!seen.has(workflow.createdBy)) {
    candidates.push({
      reviewerId: workflow.createdBy,
      reviewType: ReviewType.COORDINATOR,
    });
  }

  const assignments = [];
  for (const candidate of candidates) {
    const assignment = await tx.reviewerAssignment.create({
      data: {
        researchId: options.researchId,
        documentId: options.documentId,
        documentVersionId: options.versionId,
        reviewerId: candidate.reviewerId,
        reviewType: candidate.reviewType,
        isRequired: true,
        assignedById: workflow.createdBy,
        events: {
          create: {
            action: "ASSIGNED",
            actorId: workflow.createdBy,
            details: { source: "MILESTONE_REQUIRED_APPROVAL" },
          },
        },
      },
    });
    assignments.push(assignment);
  }
  if (assignments.length) {
    await createNotificationsOnce(
      tx,
      assignments.map((assignment) => ({
        recipientId: assignment.reviewerId,
        type: "REVIEW_ASSIGNED",
        title: "Manuscript review assigned",
        message: "A submitted manuscript version requires your review.",
        entityType: "ReviewerAssignment",
        entityId: assignment.id,
        actionUrl: `/research/manuscript?projectId=${options.researchId}&documentId=${options.documentId}&versionId=${options.versionId}&assignmentId=${assignment.id}`,
        deduplicationKey: `review-assignment:${assignment.id}:${assignment.reviewerId}`,
      })),
    );
  }
  return assignments;
}

class ReviewerAssignmentService {
  public async candidates(user: AuthenticatedUser, versionId: string) {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: { document: { select: { researchId: true } } },
    });
    if (!version)
      throw new ReviewerAssignmentError(
        "Submitted version not found.",
        404,
        "SUBMITTED_VERSION_NOT_FOUND",
      );
    const project = await workflowAuthority(
      prisma,
      version.document.researchId,
      user,
    );
    const candidates = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        NOT: {
          memberships: {
            some: {
              researchId: version.document.researchId,
              leftAt: null,
              projectRole: { in: ["LEADER", "MEMBER"] },
            },
          },
        },
        OR: [
          {
            memberships: {
              some: {
                researchId: version.document.researchId,
                leftAt: null,
                projectRole: { in: ["ADVISER", "PANELIST"] },
              },
            },
          },
          { id: user.id },
          {
            defenseInvitations: {
              some: {
                defenseSession: {
                  researchId: version.document.researchId,
                },
                status: "ACCEPTED",
                role: { in: ["PANELIST", "PANEL_CHAIR"] },
              },
            },
          },
          {
            collegeId: project.collegeId,
            roles: { some: { role: { name: { in: ["REB", "RPO"] } } } },
          },
          { roles: { some: { role: { name: "VPAA" } } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: { select: { role: { select: { name: true } } } },
        memberships: {
          where: { researchId: version.document.researchId, leftAt: null },
          select: { projectRole: true },
        },
        defenseInvitations: {
          where: {
            defenseSession: { researchId: version.document.researchId },
            status: "ACCEPTED",
            role: { in: ["PANELIST", "PANEL_CHAIR"] },
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return candidates.flatMap((candidate) => {
      const roles = candidate.roles.map(({ role }) => role.name);
      const projectRoles = candidate.memberships.map(
        ({ projectRole }) => projectRole,
      );
      const reviewTypes = new Set<ReviewType>();
      if (roles.includes("ADVISER") && projectRoles.includes("ADVISER"))
        reviewTypes.add(ReviewType.ADVISER);
      if (
        roles.includes("RESEARCH_COORDINATOR") &&
        candidate.id === user.id
      )
        reviewTypes.add(ReviewType.COORDINATOR);
      if (
        roles.includes("PANELIST") &&
        (projectRoles.includes("PANELIST") ||
          candidate.defenseInvitations.length > 0)
      )
        reviewTypes.add(ReviewType.PANEL);
      if (roles.includes("REB")) reviewTypes.add(ReviewType.REB);
      if (roles.includes("RPO") || roles.includes("VPAA"))
        reviewTypes.add(ReviewType.DEAN);
      return Array.from(reviewTypes).map((reviewType) => ({
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        reviewType,
      }));
    });
  }

  public async listMine(user: AuthenticatedUser, status?: string) {
    return prisma.reviewerAssignment.findMany({
      where: {
        reviewerId: user.id,
        ...(status ? { status: status as any } : {}),
      },
      include: assignmentInclude,
      orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
    });
  }

  public async reviewWorkflow(user: AuthenticatedUser, documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        research: {
          select: {
            id: true,
            createdBy: true,
            members: {
              where: { userId: user.id, leftAt: null },
              select: { projectRole: true },
            },
            workflowInstance: {
              select: { workflow: { select: { createdBy: true } } },
            },
          },
        },
        versions: {
          where: { isImmutable: true },
          orderBy: { versionNumber: "desc" },
          include: {
            reviewerAssignments: {
              include: assignmentInclude,
              orderBy: { assignedAt: "asc" },
            },
            reviews: {
              include: {
                reviewer: { select: reviewerSelect },
                comments: { orderBy: { createdAt: "asc" } },
              },
            },
          },
        },
      },
    });
    if (!document)
      throw new ReviewerAssignmentError(
        "Document not found.",
        404,
        "DOCUMENT_NOT_FOUND",
      );
    const isStudent = document.research.members.some(({ projectRole }) =>
      ["LEADER", "MEMBER"].includes(projectRole),
    );
    const isFaculty =
      document.research.members.some(({ projectRole }) =>
        ["ADVISER", "PANELIST", "COORDINATOR"].includes(projectRole),
      ) || document.research.workflowInstance?.workflow.createdBy === user.id;
    const isAssigned = document.versions.some((version) =>
      version.reviewerAssignments.some(
        (assignment) => assignment.reviewerId === user.id,
      ),
    );
    if (!isStudent && !isFaculty && !isAssigned) {
      throw new ReviewerAssignmentError(
        "You do not have access to this manuscript review workflow.",
        403,
        "REVIEW_WORKFLOW_ACCESS_DENIED",
      );
    }
    return {
      ...document,
      versions: document.versions.map((version) => ({
        ...version,
        reviews: version.reviews.map((review) => ({
          ...review,
          reviewer: isStudent ? null : review.reviewer,
        })),
        reviewerAssignments: version.reviewerAssignments.map((assignment) => ({
          ...assignment,
          reviewer: isStudent ? null : assignment.reviewer,
        })),
      })),
    };
  }

  public async assign(options: {
    versionId: string;
    reviewerId: string;
    reviewType: ReviewType;
    isRequired: boolean;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.findUnique({
        where: { id: options.versionId },
        include: { document: true },
      });
      if (!version || !version.isImmutable)
        throw new ReviewerAssignmentError(
          "Immutable submitted manuscript version not found.",
          404,
          "SUBMITTED_VERSION_NOT_FOUND",
        );
      if (version.document.currentVersion !== version.versionNumber)
        throw new ReviewerAssignmentError(
          "Reviewers can only be assigned to the current submitted version.",
          409,
          "VERSION_SUPERSEDED",
        );
      if (
        !["SUBMITTED", "IN_REVIEW"].includes(version.document.lifecycleStatus)
      )
        throw new ReviewerAssignmentError(
          "The manuscript is not accepting reviewer assignments in its current state.",
          409,
          "INVALID_LIFECYCLE_STATE",
        );
      await workflowAuthority(tx, version.document.researchId, options.user);
      await validateReviewer(
        tx,
        version.document.researchId,
        options.reviewerId,
        options.reviewType,
      );
      let assignment;
      try {
        assignment = await tx.reviewerAssignment.create({
          data: {
            researchId: version.document.researchId,
            documentId: version.documentId,
            documentVersionId: version.id,
            reviewerId: options.reviewerId,
            reviewType: options.reviewType,
            isRequired: options.isRequired,
            assignedById: options.user.id,
            events: {
              create: {
                action: "ASSIGNED",
                actorId: options.user.id,
                details: { source: "MANUAL" },
              },
            },
          },
          include: assignmentInclude,
        });
      } catch (error: any) {
        if (error?.code === "P2002")
          throw new ReviewerAssignmentError(
            "This reviewer already has an active assignment for this version and review type.",
            409,
            "DUPLICATE_ASSIGNMENT",
          );
        throw error;
      }
      const reviewStarted = await transitionToInReview(
        tx,
        version.documentId,
        version.id,
        options.user.id,
      );
      if (reviewStarted)
        await synchronizeTaskAttemptLifecycle(tx, {
          documentVersionId: version.id,
          lifecycleStatus: ManuscriptLifecycleStatus.IN_REVIEW,
        });
      await createNotificationsOnce(tx, [
        {
          recipientId: options.reviewerId,
          type: "REVIEW_ASSIGNED",
          title: "Manuscript review assigned",
          message: `${version.document.title} version ${version.versionNumber} requires your review.`,
          entityType: "ReviewerAssignment",
          entityId: assignment.id,
          actionUrl: `/research/manuscript?projectId=${version.document.researchId}&documentId=${version.documentId}&versionId=${version.id}&assignmentId=${assignment.id}`,
          deduplicationKey: `review-assignment:${assignment.id}:${options.reviewerId}`,
        },
      ]);
      await tx.auditLog.create({
        data: {
          userId: options.user.id,
          action: "CREATE",
          entityType: "ReviewerAssignment",
          entityId: assignment.id,
          newValues: {
            versionId: version.id,
            reviewerId: options.reviewerId,
            reviewType: options.reviewType,
            isRequired: options.isRequired,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      return assignment;
    });
  }

  public async revoke(options: {
    assignmentId: string;
    reason: string;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (options.reason.trim().length < 3)
      throw new ReviewerAssignmentError(
        "A revocation reason is required.",
        400,
        "REVOCATION_REASON_REQUIRED",
      );
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.reviewerAssignment.findUnique({
        where: { id: options.assignmentId },
      });
      if (!assignment)
        throw new ReviewerAssignmentError(
          "Reviewer assignment not found.",
          404,
          "ASSIGNMENT_NOT_FOUND",
        );
      await workflowAuthority(tx, assignment.researchId, options.user);
      const changed = await tx.reviewerAssignment.updateMany({
        where: { id: assignment.id, status: "ACTIVE" },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          statusReason: options.reason.trim(),
        },
      });
      if (!changed.count)
        throw new ReviewerAssignmentError(
          "Only an active reviewer assignment can be revoked.",
          409,
          "ASSIGNMENT_NOT_ACTIVE",
        );
      await tx.reviewerAssignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          action: "REVOKED",
          actorId: options.user.id,
          details: { reason: options.reason.trim() },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: options.user.id,
          action: "UPDATE",
          entityType: "ReviewerAssignment",
          entityId: assignment.id,
          oldValues: { status: assignment.status },
          newValues: { status: "REVOKED", reason: options.reason.trim() },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      return tx.reviewerAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        include: assignmentInclude,
      });
    });
  }

  public async reassign(options: {
    assignmentId: string;
    reviewerId: string;
    reason: string;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (options.reason.trim().length < 3)
      throw new ReviewerAssignmentError(
        "A reassignment reason is required.",
        400,
        "REASSIGNMENT_REASON_REQUIRED",
      );
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.reviewerAssignment.findUnique({
        where: { id: options.assignmentId },
      });
      if (!assignment)
        throw new ReviewerAssignmentError(
          "Reviewer assignment not found.",
          404,
          "ASSIGNMENT_NOT_FOUND",
        );
      await workflowAuthority(tx, assignment.researchId, options.user);
      await validateReviewer(
        tx,
        assignment.researchId,
        options.reviewerId,
        assignment.reviewType,
      );
      const changed = await tx.reviewerAssignment.updateMany({
        where: { id: assignment.id, status: "ACTIVE" },
        data: {
          status: "REASSIGNED",
          revokedAt: new Date(),
          statusReason: options.reason.trim(),
        },
      });
      if (!changed.count)
        throw new ReviewerAssignmentError(
          "Only an active reviewer assignment can be reassigned.",
          409,
          "ASSIGNMENT_NOT_ACTIVE",
        );
      const replacement = await tx.reviewerAssignment.create({
        data: {
          researchId: assignment.researchId,
          documentId: assignment.documentId,
          documentVersionId: assignment.documentVersionId,
          reviewerId: options.reviewerId,
          reviewType: assignment.reviewType,
          isRequired: assignment.isRequired,
          assignedById: options.user.id,
          events: {
            create: {
              action: "ASSIGNED",
              actorId: options.user.id,
              details: {
                source: "REASSIGNMENT",
                previousAssignmentId: assignment.id,
              },
            },
          },
        },
        include: assignmentInclude,
      });
      await tx.reviewerAssignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          action: "REASSIGNED",
          actorId: options.user.id,
          details: {
            reason: options.reason.trim(),
            replacementAssignmentId: replacement.id,
          },
        },
      });
      await createNotificationsOnce(tx, [
        {
          recipientId: options.reviewerId,
          type: "REVIEWER_REASSIGNED",
          title: "Manuscript review reassigned",
          message: "A manuscript review has been reassigned to you.",
          entityType: "ReviewerAssignment",
          entityId: replacement.id,
          actionUrl: `/research/manuscript?projectId=${assignment.researchId}&documentId=${assignment.documentId}&versionId=${assignment.documentVersionId}&assignmentId=${replacement.id}`,
          deduplicationKey: `review-assignment:${replacement.id}:${options.reviewerId}`,
        },
      ]);
      await tx.auditLog.create({
        data: {
          userId: options.user.id,
          action: "UPDATE",
          entityType: "ReviewerAssignment",
          entityId: assignment.id,
          oldValues: { reviewerId: assignment.reviewerId, status: "ACTIVE" },
          newValues: {
            reviewerId: options.reviewerId,
            status: "REASSIGNED",
            replacementAssignmentId: replacement.id,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      return replacement;
    });
  }

  public async decide(options: {
    assignmentId: string;
    recommendation: ReviewRecommendation;
    overallComment?: string | null;
    comments?: Array<{ comment: string; locationData?: Prisma.InputJsonValue }>;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const feedback = options.overallComment?.trim() || "";
    if (
      options.recommendation !== ReviewRecommendation.APPROVE &&
      feedback.length < 10
    )
      throw new ReviewerAssignmentError(
        "Meaningful feedback of at least 10 characters is required when requesting revisions or rejecting a version.",
        400,
        "REVISION_FEEDBACK_REQUIRED",
      );
    const comments = (options.comments || []).map((item) => ({
      comment: item.comment?.trim(),
      locationData: item.locationData,
    }));
    if (comments.some((item) => !item.comment))
      throw new ReviewerAssignmentError(
        "Review comments cannot be empty.",
        400,
        "EMPTY_REVIEW_COMMENT",
      );

    try {
      return await prisma.$transaction(
        async (tx) => {
        const assignment = await tx.reviewerAssignment.findUnique({
          where: { id: options.assignmentId },
          include: {
            document: true,
            documentVersion: true,
            research: {
              select: {
                members: {
                  where: {
                    userId: options.user.id,
                    leftAt: null,
                    projectRole: { in: ["LEADER", "MEMBER"] },
                  },
                  select: { id: true },
                },
              },
            },
          },
        });
        if (!assignment)
          throw new ReviewerAssignmentError(
            "Reviewer assignment not found.",
            404,
            "ASSIGNMENT_NOT_FOUND",
          );
        await lockMilestoneProject(tx, assignment.researchId);
        if (options.recommendation === "APPROVE" && assignment.documentVersion.milestoneId) {
          await assertMilestoneAvailable(tx, assignment.researchId, assignment.documentVersion.milestoneId);
        }
        if (assignment.reviewerId !== options.user.id)
          throw new ReviewerAssignmentError(
            "Only the assigned reviewer can submit this decision.",
            403,
            "ASSIGNED_REVIEWER_REQUIRED",
          );
        if (assignment.research.members.length)
          throw new ReviewerAssignmentError(
            "Students cannot approve their own manuscript.",
            403,
            "STUDENT_SELF_APPROVAL_FORBIDDEN",
          );
        if (
          !assignment.documentVersion.isImmutable ||
          assignment.document.currentVersion !==
            assignment.documentVersion.versionNumber
        )
          throw new ReviewerAssignmentError(
            "This reviewer assignment does not reference the current immutable submitted version.",
            409,
            "VERSION_SUPERSEDED",
          );
        const changed = await tx.reviewerAssignment.updateMany({
          where: { id: assignment.id, status: "ACTIVE" },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        if (!changed.count)
          throw new ReviewerAssignmentError(
            "This reviewer assignment has already been resolved.",
            409,
            "ASSIGNMENT_ALREADY_RESOLVED",
          );

        const review = await tx.review.create({
          data: {
            assignmentId: assignment.id,
            documentVersionId: assignment.documentVersionId,
            documentId: assignment.documentId,
            reviewerId: options.user.id,
            reviewType: assignment.reviewType,
            overallComment: feedback || null,
            recommendation: options.recommendation,
            status: "SUBMITTED",
            submittedAt: new Date(),
            comments: comments.length
              ? {
                  create: comments.map((item) => ({
                    documentVersionId: assignment.documentVersionId,
                    authorId: options.user.id,
                    comment: item.comment,
                    locationData: item.locationData,
                  })),
                }
              : undefined,
          },
          include: {
            reviewer: { select: reviewerSelect },
            comments: true,
          },
        });
        await tx.reviewerAssignmentEvent.create({
          data: {
            assignmentId: assignment.id,
            action: "COMPLETED",
            actorId: options.user.id,
            details: { recommendation: options.recommendation },
          },
        });

        let lifecycleStatus = assignment.document.lifecycleStatus;
        const requiresRevision =
          assignment.isRequired &&
          options.recommendation !== ReviewRecommendation.APPROVE;
        if (requiresRevision) {
          const openAssignments = await tx.reviewerAssignment.findMany({
            where: {
              documentVersionId: assignment.documentVersionId,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          const supersededAt = new Date();
          if (openAssignments.length) {
            await tx.reviewerAssignment.updateMany({
              where: { id: { in: openAssignments.map(({ id }) => id) } },
              data: {
                status: "SUPERSEDED",
                revokedAt: supersededAt,
                statusReason: "Another required reviewer requested revisions.",
              },
            });
            await tx.reviewerAssignmentEvent.createMany({
              data: openAssignments.map(({ id: assignmentId }) => ({
                assignmentId,
                action: "SUPERSEDED" as const,
                actorId: options.user.id,
                details: { triggeringAssignmentId: assignment.id },
              })),
            });
          }
          const lifecycleChanged = await tx.document.updateMany({
            where: {
              id: assignment.documentId,
              lifecycleStatus: { in: ["SUBMITTED", "IN_REVIEW"] },
            },
            data: { lifecycleStatus: "REVISION_REQUIRED" },
          });
          if (!lifecycleChanged.count)
            throw new ReviewerAssignmentError(
              "The manuscript lifecycle changed while the decision was being submitted.",
              409,
              "CONCURRENT_DECISION_CONFLICT",
            );
          await tx.documentVersion.update({
            where: { id: assignment.documentVersionId },
            data: { manuscriptStatus: "REVISION_REQUIRED" },
          });
          await tx.manuscriptStatusEvent.create({
            data: {
              documentId: assignment.documentId,
              versionId: assignment.documentVersionId,
              fromStatus: assignment.document.lifecycleStatus,
              toStatus: "REVISION_REQUIRED",
              actorId: options.user.id,
              reason: feedback,
              metadata: { assignmentId: assignment.id, reviewId: review.id },
            },
          });
          lifecycleStatus = ManuscriptLifecycleStatus.REVISION_REQUIRED;
        } else {
          const required = await tx.reviewerAssignment.findMany({
            where: {
              documentVersionId: assignment.documentVersionId,
              isRequired: true,
              status: { in: ["ACTIVE", "COMPLETED"] },
            },
            include: { review: { select: { recommendation: true } } },
          });
          const approvalSatisfied =
            required.length > 0 &&
            required.every(
              (item) =>
                item.status === "COMPLETED" &&
                item.review?.recommendation === ReviewRecommendation.APPROVE,
            );
          if (approvalSatisfied) {
            const remainingOptionalAssignments =
              await tx.reviewerAssignment.findMany({
                where: {
                  documentVersionId: assignment.documentVersionId,
                  isRequired: false,
                  status: "ACTIVE",
                },
                select: { id: true },
              });
            if (remainingOptionalAssignments.length) {
              const supersededAt = new Date();
              await tx.reviewerAssignment.updateMany({
                where: {
                  id: {
                    in: remainingOptionalAssignments.map(({ id }) => id),
                  },
                },
                data: {
                  status: "SUPERSEDED",
                  revokedAt: supersededAt,
                  statusReason:
                    "The mandatory approval requirements were completed.",
                },
              });
              await tx.reviewerAssignmentEvent.createMany({
                data: remainingOptionalAssignments.map(
                  ({ id: assignmentId }) => ({
                    assignmentId,
                    action: "SUPERSEDED" as const,
                    actorId: options.user.id,
                    details: {
                      triggeringAssignmentId: assignment.id,
                      reason: "MANDATORY_APPROVALS_COMPLETED",
                    },
                  }),
                ),
              });
            }
            const lifecycleChanged = await tx.document.updateMany({
              where: {
                id: assignment.documentId,
                lifecycleStatus: { in: ["SUBMITTED", "IN_REVIEW"] },
              },
              data: { lifecycleStatus: "APPROVED" },
            });
            if (!lifecycleChanged.count)
              throw new ReviewerAssignmentError(
                "The manuscript lifecycle changed while approvals were being calculated.",
                409,
                "CONCURRENT_DECISION_CONFLICT",
              );
            await tx.documentVersion.update({
              where: { id: assignment.documentVersionId },
              data: { manuscriptStatus: "APPROVED" },
            });
            await tx.manuscriptStatusEvent.create({
              data: {
                documentId: assignment.documentId,
                versionId: assignment.documentVersionId,
                fromStatus: assignment.document.lifecycleStatus,
                toStatus: "APPROVED",
                actorId: options.user.id,
                reason: "All configured mandatory reviewers approved this version.",
                metadata: { assignmentId: assignment.id, reviewId: review.id },
              },
            });
            const draftPackets = await tx.defensePacket.findMany({
              where: {
                status: "DRAFT",
                defenseSession: { researchId: assignment.researchId },
                manuscriptVersion: { documentId: assignment.documentId },
              },
              select: { id: true },
            });
            if (draftPackets.length) {
              await tx.defensePacket.updateMany({
                where: { id: { in: draftPackets.map(({ id }) => id) } },
                data: { manuscriptVersionId: assignment.documentVersionId },
              });
            }
            await tx.researchProject.updateMany({
              where: {
                id: assignment.researchId,
                status: "REVISION",
                defenseSessions: {
                  some: {
                    status: "COMPLETED",
                    decision: {
                      in: [
                        "APPROVED_WITH_MINOR_REVISIONS",
                        "MAJOR_REVISIONS_REQUIRED",
                      ],
                    },
                    packet: {
                      is: {
                        manuscriptVersion: {
                          documentId: assignment.documentId,
                        },
                      },
                    },
                  },
                },
              },
              data: { status: "APPROVED" },
            });
            lifecycleStatus = ManuscriptLifecycleStatus.APPROVED;
          }
        }

        await synchronizeTaskAttemptLifecycle(tx, {
          documentVersionId: assignment.documentVersionId,
          lifecycleStatus,
          reviewNote:
            lifecycleStatus === ManuscriptLifecycleStatus.REVISION_REQUIRED
              ? feedback
              : lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                ? "All configured mandatory manuscript reviews were approved."
                : null,
        });
        let milestoneProgression: Awaited<
          ReturnType<typeof advanceMilestoneIfSatisfied>
        > | null = null;
        if (
          lifecycleStatus === ManuscriptLifecycleStatus.APPROVED &&
          assignment.documentVersion.milestoneId
        ) {
          milestoneProgression = await advanceMilestoneIfSatisfied(tx, {
            researchId: assignment.researchId,
            milestoneId: assignment.documentVersion.milestoneId,
            actorId: options.user.id,
          });
        }

        const researchers = await tx.researchMember.findMany({
          where: {
            researchId: assignment.researchId,
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER"] },
          },
          select: { userId: true },
        });
        if (researchers.length) {
          const notificationType =
            lifecycleStatus === ManuscriptLifecycleStatus.REVISION_REQUIRED
              ? "REVISION_REQUESTED"
              : lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                ? "MANUSCRIPT_APPROVED"
                : "DOCUMENT_REVIEWED";
          await createNotificationsOnce(
            tx,
            researchers.map(({ userId: recipientId }) => ({
              recipientId,
              type: notificationType,
              title:
                lifecycleStatus === ManuscriptLifecycleStatus.REVISION_REQUIRED
                  ? "Manuscript revision required"
                  : lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                    ? "Manuscript approved"
                    : "Manuscript review completed",
              message:
                lifecycleStatus === ManuscriptLifecycleStatus.REVISION_REQUIRED
                  ? feedback
                  : lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                    ? "All mandatory reviewers approved the current manuscript version."
                    : "A faculty reviewer submitted a decision.",
              entityType: "DocumentVersion",
              entityId: assignment.documentVersionId,
              actionUrl: `/research/manuscript?projectId=${assignment.researchId}&documentId=${assignment.documentId}&versionId=${assignment.documentVersionId}`,
              deduplicationKey: `manuscript:${assignment.documentVersionId}:decision:${lifecycleStatus}:${recipientId}`,
            })),
          );
        }
        const oversight = await tx.researchProject.findUnique({
          where: { id: assignment.researchId },
          select: {
            members: {
              where: { leftAt: null, projectRole: "ADVISER" },
              select: { userId: true },
            },
            workflowInstance: {
              select: { workflow: { select: { createdBy: true } } },
            },
          },
        });
        const oversightRecipients = new Set(
          oversight?.members.map(({ userId }) => userId) || [],
        );
        if (oversight?.workflowInstance?.workflow.createdBy)
          oversightRecipients.add(oversight.workflowInstance.workflow.createdBy);
        oversightRecipients.delete(options.user.id);
        if (oversightRecipients.size) {
          await createNotificationsOnce(
            tx,
            Array.from(oversightRecipients).map((recipientId) => ({
              recipientId,
              type:
                lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                  ? "MANUSCRIPT_APPROVED"
                  : "DOCUMENT_REVIEWED",
              title:
                lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                  ? "Manuscript ready for defense"
                  : "Required manuscript review completed",
              message:
                lifecycleStatus === ManuscriptLifecycleStatus.APPROVED
                  ? `${assignment.document.title} is fully approved. Its exact immutable version can now be selected for an eligible defense packet.`
                  : `${assignment.document.title} has a recorded review decision and is now ${lifecycleStatus.toLowerCase().replace(/_/g, " ")}.`,
              entityType: "DocumentVersion",
              entityId: assignment.documentVersionId,
              actionUrl: `/research/manuscript?projectId=${assignment.researchId}&documentId=${assignment.documentId}&versionId=${assignment.documentVersionId}`,
              deduplicationKey: `manuscript:${assignment.documentVersionId}:assignment:${assignment.id}:oversight:${recipientId}`,
            })),
          );
        }
        await tx.auditLog.create({
          data: {
            userId: options.user.id,
            action: "CREATE",
            entityType: "ManuscriptReviewDecision",
            entityId: review.id,
            newValues: {
              assignmentId: assignment.id,
              documentVersionId: assignment.documentVersionId,
              recommendation: options.recommendation,
              lifecycleStatus,
            },
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
          },
        });
        return { review, lifecycleStatus, milestoneProgression };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error?.code === "P2034")
        throw new ReviewerAssignmentError(
          "Another reviewer decision completed at the same time. Refresh to see the final status.",
          409,
          "CONCURRENT_DECISION_CONFLICT",
        );
      throw error;
    }
  }
}

export const reviewerAssignmentService = new ReviewerAssignmentService();
export { reviewTypeForRole };
