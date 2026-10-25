import { assertMilestoneAvailable, lockMilestoneProject } from "./milestone-eligibility.service.js";
import crypto from "node:crypto";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { ManuscriptLifecycleStatus, prisma } from "../lib/prisma.js";
import {
  type DriveSnapshotResult,
  googleDriveService,
} from "./google-drive.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import { createConfiguredAssignmentsForSubmission } from "./reviewer-assignment.service.js";
import {
  createNotificationsOnce,
  recordTaskSubmissionAttempt,
} from "./research-workflow-integration.service.js";
import {
  assertTaskSubmissionLifecycle,
  assertTaskWorkflowEnrollment,
  authorizeTaskSubmission,
  isDocumentLifecycleSubmittable,
  liveGoogleDocumentEligibility,
  runSubmissionTransaction,
  SubmissionIntegrityError,
} from "./submission.service.js";

const SUBMISSION_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export class ManuscriptWorkflowError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "MANUSCRIPT_WORKFLOW_ERROR",
  ) {
    super(message);
    this.name = "ManuscriptWorkflowError";
  }
}

export function canSubmitFromStatus(status: ManuscriptLifecycleStatus) {
  return isDocumentLifecycleSubmittable(status);
}

export function canTransitionManuscript(
  from: ManuscriptLifecycleStatus,
  to: ManuscriptLifecycleStatus,
) {
  return (
    (from === ManuscriptLifecycleStatus.SUBMITTED &&
      to === ManuscriptLifecycleStatus.IN_REVIEW) ||
    (from === ManuscriptLifecycleStatus.IN_REVIEW &&
      to === ManuscriptLifecycleStatus.REVISION_REQUIRED)
  );
}

function safeSnapshotName(title: string, versionNumber: number) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
  return `${base || "manuscript"}-v${versionNumber}-submitted.pdf`;
}

class ManuscriptLifecycleService {
  public async submit(options: {
    documentId: string;
    milestoneId: string;
    taskId?: string | null;
    idempotencyKey: string;
    note?: string | null;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const key = options.idempotencyKey.trim();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) {
      throw new ManuscriptWorkflowError(
        "A valid submission idempotency key is required.",
        400,
        "INVALID_IDEMPOTENCY_KEY",
      );
    }
    if (!options.user.roles.includes("RESEARCHER")) {
      throw new ManuscriptWorkflowError(
        "Only an active student research-group member can submit a manuscript.",
        403,
        "SUBMISSION_ROLE_REQUIRED",
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: options.documentId },
      include: {
        research: {
          include: {
            members: {
              where: {
                userId: options.user.id,
                leftAt: null,
                projectRole: { in: ["LEADER", "MEMBER"] },
              },
              select: { id: true },
            },
            workflowInstance: { select: { workflowId: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true },
        },
      },
    });
    if (!document)
      throw new ManuscriptWorkflowError(
        "Document not found.",
        404,
        "DOCUMENT_NOT_FOUND",
      );
    if (!document.research.members.length) {
      throw new ManuscriptWorkflowError(
        "You are not an active student member of this research project.",
        403,
        "PROJECT_MEMBERSHIP_REQUIRED",
      );
    }
    const existingByKey = await prisma.documentVersion.findFirst({
      where: { documentId: options.documentId, submissionKey: key },
      include: {
        milestone: { select: { id: true, name: true, sequence: true } },
        submitter: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (existingByKey)
      return {
        version: existingByKey,
        lifecycleStatus:
          existingByKey.manuscriptStatus || ManuscriptLifecycleStatus.SUBMITTED,
        duplicate: true,
      };
    if (!document.liveExternalFileId || !document.liveDocumentUrl) {
      throw new ManuscriptWorkflowError(
        "Only a linked live Google document can be formally submitted from this workspace.",
        400,
        "LIVE_DOCUMENT_REQUIRED",
      );
    }
    if (!canSubmitFromStatus(document.lifecycleStatus)) {
      throw new ManuscriptWorkflowError(
        `A manuscript in ${document.lifecycleStatus.replace(/_/g, " ").toLowerCase()} status cannot be submitted again.`,
        409,
        "INVALID_LIFECYCLE_STATE",
      );
    }
    const workflowId = document.research.workflowInstance?.workflowId;
    if (!workflowId)
      throw new ManuscriptWorkflowError(
        "This research project does not have an assigned workflow.",
        400,
        "WORKFLOW_REQUIRED",
      );
    const milestone = await prisma.workflowStage.findFirst({
      where: {
        id: options.milestoneId,
        workflowId,
        category: { not: "Archived" },
      },
      select: { id: true, name: true, sequence: true },
    });
    if (!milestone)
      throw new ManuscriptWorkflowError(
        "The selected milestone does not belong to this research project.",
        400,
        "INVALID_MILESTONE",
      );

    await assertMilestoneAvailable(prisma, document.researchId, milestone.id);
    let task: { id: string; title: string; allowedFileTypes: string } | null =
      null;
    if (options.taskId) {
      const taskContext = await authorizeTaskSubmission({
        user: options.user,
        researchId: document.researchId,
        taskId: options.taskId,
      });
      if (taskContext.task.stageId !== milestone.id)
        throw new ManuscriptWorkflowError(
          "The selected task does not belong to the manuscript milestone.",
          400,
          "INVALID_TASK",
        );
      task = {
        id: taskContext.task.id,
        title: taskContext.task.title,
        allowedFileTypes: taskContext.task.allowedFileTypes,
      };
      const eligibilityReasons = liveGoogleDocumentEligibility({
        allowedFileTypes: task.allowedFileTypes,
        taskMilestoneId: taskContext.task.stageId,
        documentMilestoneId: document.milestoneId,
        documentLifecycleStatus: document.lifecycleStatus,
        liveDocumentUrl: document.liveDocumentUrl,
        liveExternalFileId: document.liveExternalFileId,
      });
      if (eligibilityReasons.length) {
        const reason = eligibilityReasons[0];
        throw new SubmissionIntegrityError(
          reason.message,
          reason.statusCode,
          reason.code,
        );
      }
      await assertTaskSubmissionLifecycle(prisma, {
        researchId: document.researchId,
        taskId: task.id,
      });
    } else {
      const configuredTaskCount = await prisma.workflowTask.count({
        where: { stageId: milestone.id },
      });
      if (configuredTaskCount > 0)
        throw new ManuscriptWorkflowError(
          "Select the configured milestone task for this manuscript submission.",
          400,
          "TASK_REQUIRED",
        );
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - SUBMISSION_LOCK_TIMEOUT_MS);
    const claimed = await prisma.document.updateMany({
      where: {
        id: document.id,
        lifecycleStatus: { in: ["DRAFT", "REVISION_REQUIRED"] },
        OR: [
          { pendingSubmissionKey: null, pendingSubmissionAt: null },
          { pendingSubmissionAt: { lt: staleBefore } },
        ],
      },
      data: { pendingSubmissionKey: key, pendingSubmissionAt: now },
    });
    if (!claimed.count) {
      const current = await prisma.document.findUnique({
        where: { id: document.id },
        select: { pendingSubmissionKey: true, lifecycleStatus: true },
      });
      if (current?.pendingSubmissionKey === key) {
        throw new ManuscriptWorkflowError(
          "This submission is still being processed.",
          409,
          "SUBMISSION_IN_PROGRESS",
        );
      }
      throw new ManuscriptWorkflowError(
        "Another submission is already in progress or the document status changed.",
        409,
        "CONCURRENT_SUBMISSION",
      );
    }

    let uploadedFileId: string | null = null;
    let committed = false;
    try {
      let snapshot: DriveSnapshotResult;
      try {
        snapshot = await googleDriveService.exportImmutablePdf(
          document.liveExternalFileId,
        );
      } catch (error: any) {
        const googleStatus = Number(
          error?.response?.status || error?.code || 0,
        );
        if ([401, 403, 404].includes(googleStatus)) throw error;
        const message =
          typeof error?.message === "string"
            ? error.message
            : "The linked Google document could not be exported.";
        throw new ManuscriptWorkflowError(
          message,
          /not connected/i.test(message) ? 503 : 422,
          /not connected/i.test(message)
            ? "STORAGE_NOT_CONNECTED"
            : "GOOGLE_DOCUMENT_NOT_EXPORTABLE",
        );
      }
      const checksum = crypto
        .createHash("sha256")
        .update(snapshot.buffer)
        .digest("hex");
      const nextVersionNumber = (document.versions[0]?.versionNumber || 0) + 1;
      const destinationFolderId = await storageHierarchyService.resolveFolder({
        researchId: document.researchId,
        bucket: "SUBMISSIONS",
        stageId: milestone.id,
      });
      const uploaded = await googleDriveService.uploadFile({
        fileName: safeSnapshotName(document.title, nextVersionNumber),
        mimeType: snapshot.mimeType,
        buffer: snapshot.buffer,
        folderId: destinationFolderId,
        description: `Immutable Advisio manuscript submission: ${document.title}`,
        appProperties: {
          advisioManaged: "true",
          advisioLifecycle: "SUBMITTED_SNAPSHOT",
          advisioResearchId: document.researchId,
          advisioDocumentId: document.id,
          advisioMilestoneId: milestone.id,
          advisioSubmitterId: options.user.id,
          advisioChecksum: checksum,
        },
      });
      uploadedFileId = uploaded.fileId;

      const result = await runSubmissionTransaction(async (tx) => {
        await lockMilestoneProject(tx, document.researchId);
        await assertTaskWorkflowEnrollment(tx, options.user.id, workflowId);
        await assertMilestoneAvailable(tx, document.researchId, milestone.id);
        const locked = await tx.document.findFirst({
          where: {
            id: document.id,
            pendingSubmissionKey: key,
            lifecycleStatus: { in: ["DRAFT", "REVISION_REQUIRED"] },
          },
          select: { lifecycleStatus: true },
        });
        if (!locked)
          throw new ManuscriptWorkflowError(
            "The manuscript changed while the snapshot was being created.",
            409,
            "SUBMISSION_STATE_CHANGED",
          );
        if (task) {
          await assertTaskSubmissionLifecycle(tx, {
            researchId: document.researchId,
            taskId: task.id,
          });
        }

        const latest = await tx.documentVersion.findFirst({
          where: { documentId: document.id },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });
        const versionNumber = (latest?.versionNumber || 0) + 1;
        await tx.documentVersion.updateMany({
          where: {
            documentId: document.id,
            isImmutable: true,
            status: "ACTIVE",
          },
          data: { status: "SUPERSEDED" },
        });
        const submittedAt = new Date();
        const version = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber,
            fileName: uploaded.fileName,
            mimeType: "application/pdf",
            fileSize: BigInt(uploaded.sizeBytes),
            storagePath: uploaded.storagePath,
            googleDriveFileId: uploaded.fileId,
            uploadedBy: options.user.id,
            status: "ACTIVE",
            manuscriptStatus: "SUBMITTED",
            isImmutable: true,
            contentChecksum: checksum,
            submissionKey: key,
            submittedBy: options.user.id,
            submittedAt,
            snapshotCreatedAt: submittedAt,
            sourceExternalFileId: document.liveExternalFileId,
            sourceModifiedAt: snapshot.sourceModifiedAt,
            milestoneId: milestone.id,
          },
          include: {
            milestone: { select: { id: true, name: true, sequence: true } },
            submitter: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
        await tx.document.update({
          where: { id: document.id },
          data: {
            milestoneId: milestone.id,
            lifecycleStatus: "SUBMITTED",
            currentVersion: versionNumber,
            storageProvider: "GOOGLE_DRIVE",
            externalFileId: uploaded.fileId,
            pendingSubmissionKey: null,
            pendingSubmissionAt: null,
          },
        });
        await tx.manuscriptStatusEvent.create({
          data: {
            documentId: document.id,
            versionId: version.id,
            fromStatus: locked.lifecycleStatus,
            toStatus: "SUBMITTED",
            actorId: options.user.id,
            reason: options.note?.trim() || null,
            metadata: {
              checksum,
              milestoneId: milestone.id,
              taskId: task?.id || null,
              sourceModifiedAt:
                snapshot.sourceModifiedAt?.toISOString() || null,
            },
          },
        });
        const assignments = await createConfiguredAssignmentsForSubmission(tx, {
          researchId: document.researchId,
          documentId: document.id,
          versionId: version.id,
          milestoneId: milestone.id,
        });
        let lifecycleStatus: ManuscriptLifecycleStatus =
          ManuscriptLifecycleStatus.SUBMITTED;
        if (assignments.length) {
          await tx.document.update({
            where: { id: document.id },
            data: { lifecycleStatus: ManuscriptLifecycleStatus.IN_REVIEW },
          });
          await tx.documentVersion.update({
            where: { id: version.id },
            data: { manuscriptStatus: ManuscriptLifecycleStatus.IN_REVIEW },
          });
          await tx.manuscriptStatusEvent.create({
            data: {
              documentId: document.id,
              versionId: version.id,
              fromStatus: ManuscriptLifecycleStatus.SUBMITTED,
              toStatus: ManuscriptLifecycleStatus.IN_REVIEW,
              actorId: assignments[0].assignedById,
              reason: "Required manuscript reviewers were assigned.",
            },
          });
          lifecycleStatus = ManuscriptLifecycleStatus.IN_REVIEW;
        }
        if (task) {
          await recordTaskSubmissionAttempt(tx, {
            researchId: document.researchId,
            taskId: task.id,
            milestoneId: milestone.id,
            documentId: document.id,
            documentVersionId: version.id,
            submittedBy: options.user.id,
            submittedAt,
            note: options.note,
            lifecycleStatus,
          });
        }
        await tx.auditLog.create({
          data: {
            userId: options.user.id,
            action: "CREATE",
            entityType: "ManuscriptSubmission",
            entityId: version.id,
            newValues: {
              documentId: document.id,
              versionNumber,
              milestoneId: milestone.id,
              checksum,
              status: "SUBMITTED",
            },
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
          },
        });

        const assignedReviewerIds = new Set(
          assignments.map(({ reviewerId }) => reviewerId),
        );
        const recipients = new Set<string>();
        const projectRecipients = await tx.researchProject.findUnique({
          where: { id: document.researchId },
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
        projectRecipients?.members.forEach(({ userId }) =>
          recipients.add(userId),
        );
        if (projectRecipients?.workflowInstance?.workflow.createdBy)
          recipients.add(projectRecipients.workflowInstance.workflow.createdBy);
        recipients.delete(options.user.id);
        assignedReviewerIds.forEach((reviewerId) =>
          recipients.delete(reviewerId),
        );
        await createNotificationsOnce(tx, [
          {
            recipientId: options.user.id,
            type: "DOCUMENT_UPLOADED",
            title: "Manuscript submitted successfully",
            message: `${document.title} version ${versionNumber} was recorded for ${milestone.name}.`,
            entityType: "DocumentVersion",
            entityId: version.id,
            actionUrl: `/research/manuscript?projectId=${document.researchId}&milestoneId=${milestone.id}&documentId=${document.id}&versionId=${version.id}`,
            deduplicationKey: `manuscript:${version.id}:submitted:${options.user.id}`,
          },
          ...Array.from(recipients).map((recipientId) => ({
            recipientId,
            type: "DOCUMENT_UPLOADED",
            title: "Manuscript submitted",
            message: `${document.title} version ${versionNumber} was submitted for ${milestone.name}.`,
            entityType: "DocumentVersion",
            entityId: version.id,
            actionUrl: `/research/manuscript?projectId=${document.researchId}&milestoneId=${milestone.id}&documentId=${document.id}&versionId=${version.id}`,
            deduplicationKey: `manuscript:${version.id}:submitted:${recipientId}`,
          })),
        ]);
        return { version, lifecycleStatus };
      });
      committed = true;
      return {
        version: result.version,
        lifecycleStatus: result.lifecycleStatus,
        duplicate: false,
      };
    } catch (error) {
      if (uploadedFileId && !committed) {
        await googleDriveService
          .deleteStoredFile(uploadedFileId)
          .catch(() => false);
      }
      throw error;
    } finally {
      if (!committed) {
        await prisma.document
          .updateMany({
            where: { id: document.id, pendingSubmissionKey: key },
            data: { pendingSubmissionKey: null, pendingSubmissionAt: null },
          })
          .catch(() => undefined);
      }
    }
  }

  public async transition(options: {
    documentId: string;
    targetStatus: ManuscriptLifecycleStatus;
    reason?: string | null;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    void options;
    throw new ManuscriptWorkflowError(
      "Direct manuscript review transitions are disabled. Submit a decision through an active exact-version reviewer assignment.",
      409,
      "FORMAL_REVIEW_ASSIGNMENT_REQUIRED",
    );
  }
}

export const manuscriptLifecycleService = new ManuscriptLifecycleService();
