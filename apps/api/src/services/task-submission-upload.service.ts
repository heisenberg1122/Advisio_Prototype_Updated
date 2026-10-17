import { createHash } from "node:crypto";
import { ManuscriptLifecycleStatus, prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { documentService } from "./document.service.js";
import {
  createNotificationsOnce,
  recordTaskSubmissionAttempt,
} from "./research-workflow-integration.service.js";
import {
  assertTaskSubmissionLifecycle,
  authorizeTaskSubmission,
  configureTaskSubmissionReview,
  runSubmissionTransaction,
  storedVersionEligibility,
  storedVersionSubmissionKey,
  SubmissionIntegrityError,
  validateSubmissionArtifact,
} from "./submission.service.js";

export function taskUploadOperationKey(input: {
  researchId: string;
  taskId: string;
  userId: string;
  clientKey: string;
}) {
  return createHash("sha256")
    .update(
      `${input.researchId}:${input.taskId}:${input.userId}:${input.clientKey}`,
    )
    .digest("hex");
}

const submissionInclude = {
  document: {
    include: {
      versions: { orderBy: { versionNumber: "desc" as const }, take: 1 },
    },
  },
  task: true,
  submittedByUser: {
    select: { id: true, firstName: true, lastName: true, universityId: true },
  },
  attempts: { orderBy: { attemptNumber: "desc" as const } },
};

async function existingOperation(options: {
  creationKey: string;
  researchId: string;
  taskId: string;
  userId: string;
}) {
  const document = await prisma.document.findFirst({
    where: {
      creationKey: options.creationKey,
      researchId: options.researchId,
      createdBy: options.userId,
    },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!document) return null;
  const submission = await prisma.taskSubmission.findFirst({
    where: {
      researchId: options.researchId,
      taskId: options.taskId,
      documentId: document.id,
    },
    include: submissionInclude,
  });
  return submission
    ? { document, version: document.versions[0], submission, duplicate: true }
    : null;
}

export async function uploadTaskSubmission(options: {
  user: AuthenticatedUser;
  researchId: string;
  taskId: string;
  clientKey: string;
  title: string;
  note?: string | null;
  file: { buffer: Buffer; originalname: string; mimetype: string };
  ipAddress?: string;
  userAgent?: string;
}) {
  const { project, task } = await authorizeTaskSubmission({
    user: options.user,
    researchId: options.researchId,
    taskId: options.taskId,
  });
  const creationKey = taskUploadOperationKey({
    researchId: options.researchId,
    taskId: options.taskId,
    userId: options.user.id,
    clientKey: options.clientKey,
  });
  const operationScope = {
    creationKey,
    researchId: options.researchId,
    taskId: options.taskId,
    userId: options.user.id,
  };
  const previous = await existingOperation(operationScope);
  if (previous) return previous;
  validateSubmissionArtifact({
    allowedFileTypes: task.allowedFileTypes,
    fileName: options.file.originalname,
    mimeType: options.file.mimetype,
    buffer: options.file.buffer,
  });
  await assertTaskSubmissionLifecycle(prisma, {
    researchId: options.researchId,
    taskId: options.taskId,
  });

  const payload = {
    researchId: options.researchId,
    milestoneId: task.stageId,
    title: options.title,
    documentType: `TASK_${task.id}`,
    fileBuffer: options.file.buffer,
    fileName: options.file.originalname,
    mimeType: options.file.mimetype,
    uploadedBy: options.user.id,
  };
  const { provider, storageResult } =
    await documentService.storeDocumentFile(payload);
  const checksum = createHash("sha256")
    .update(options.file.buffer)
    .digest("hex");
  let result: any = null;

  try {
    result = await runSubmissionTransaction(async (tx) => {
      await assertTaskSubmissionLifecycle(tx, {
        researchId: options.researchId,
        taskId: options.taskId,
      });
      const document = await tx.document.create({
        data: {
          researchId: options.researchId,
          milestoneId: task.stageId,
          documentType: `TASK_${task.id}`,
          title: options.title,
          currentVersion: 1,
          storageProvider: provider,
          externalFileId: storageResult.fileId,
          lifecycleStatus: ManuscriptLifecycleStatus.SUBMITTED,
          creationKey,
          createdBy: options.user.id,
        },
      });
      const submittedAt = new Date();
      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          milestoneId: task.stageId,
          versionNumber: 1,
          fileName: storageResult.fileName,
          mimeType: storageResult.mimeType,
          fileSize: BigInt(storageResult.sizeBytes),
          storagePath: storageResult.webViewLink || storageResult.storagePath,
          googleDriveFileId:
            provider === "GOOGLE_DRIVE" ? storageResult.fileId : null,
          uploadedBy: options.user.id,
          status: "ACTIVE",
          manuscriptStatus: ManuscriptLifecycleStatus.SUBMITTED,
          isImmutable: true,
          contentChecksum: checksum,
          submissionKey: creationKey,
          submittedBy: options.user.id,
          submittedAt,
          snapshotCreatedAt: submittedAt,
        },
      });
      const review = await configureTaskSubmissionReview(tx, {
        researchId: options.researchId,
        documentId: document.id,
        versionId: version.id,
        milestoneId: task.stageId,
        actorId: options.user.id,
        reason: options.note,
      });
      const recorded = await recordTaskSubmissionAttempt(tx, {
        researchId: options.researchId,
        taskId: task.id,
        milestoneId: task.stageId,
        documentId: document.id,
        documentVersionId: version.id,
        submittedBy: options.user.id,
        submittedAt,
        note: options.note,
        lifecycleStatus: review.lifecycleStatus,
      });
      await tx.auditLog.create({
        data: {
          userId: options.user.id,
          action: "CREATE",
          entityType: "TaskSubmissionAttempt",
          entityId: recorded.attempt.id,
          newValues: {
            researchId: options.researchId,
            taskId: task.id,
            documentId: document.id,
            documentVersionId: version.id,
            operationKey: creationKey,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      const submission = await tx.taskSubmission.findUniqueOrThrow({
        where: { id: recorded.summary.id },
        include: submissionInclude,
      });
      const [persistedDocument, persistedVersion] = await Promise.all([
        tx.document.findUniqueOrThrow({ where: { id: document.id } }),
        tx.documentVersion.findUniqueOrThrow({ where: { id: version.id } }),
      ]);
      return {
        document: persistedDocument,
        version: persistedVersion,
        submission,
        duplicate: false,
      };
    });
  } catch (error: any) {
    const existing = await existingOperation(operationScope);
    if (existing) {
      await documentService.cleanupStoredFile(provider, storageResult);
      return existing;
    }
    await documentService.cleanupStoredFile(provider, storageResult);
    throw error;
  }
  if (!result) {
    await documentService.cleanupStoredFile(provider, storageResult);
    throw new Error("Unable to commit the task submission.");
  }

  const recipientIds = new Set<string>();
  const workflowOwnerId = project.workflowInstance?.workflow.createdBy;
  if (workflowOwnerId && workflowOwnerId !== options.user.id)
    recipientIds.add(workflowOwnerId);
  project.members.forEach((member) => {
    if (member.projectRole === "ADVISER" && member.userId !== options.user.id)
      recipientIds.add(member.userId);
  });
  try {
    const recipients = await prisma.user.findMany({
      where: { id: { in: Array.from(recipientIds) }, status: "ACTIVE" },
      select: { id: true },
    });
    await createNotificationsOnce(
      prisma,
      recipients.map(({ id: recipientId }) => ({
        recipientId,
        type: "DOCUMENT_UPLOADED",
        title: "Research task submitted",
        message: `${project.title}: ${task.title} was submitted for review.`,
        entityType: "TaskSubmission",
        entityId: result.submission.id,
        actionUrl: `/research/manuscript?projectId=${options.researchId}&milestoneId=${task.stageId}&taskId=${task.id}&documentId=${result.document.id}&versionId=${result.version.id}`,
        deduplicationKey: `task-attempt:${result.version.id}:submitted:${recipientId}`,
      })),
    );
  } catch (error) {
    console.error(
      "Task submission saved, but reviewer notifications failed:",
      error,
    );
  }
  return result;
}

export async function submitStoredTaskVersion(options: {
  user: AuthenticatedUser;
  researchId: string;
  taskId: string;
  documentId: string;
  documentVersionId?: string | null;
  note?: string | null;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { project, task } = await authorizeTaskSubmission({
    user: options.user,
    researchId: options.researchId,
    taskId: options.taskId,
  });
  const document = await prisma.document.findFirst({
    where: { id: options.documentId, researchId: options.researchId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          storagePath: true,
          googleDriveFileId: true,
          status: true,
          milestoneId: true,
          isImmutable: true,
          submissionKey: true,
        },
      },
    },
  });
  if (!document)
    throw new SubmissionIntegrityError(
      "The uploaded document does not belong to this project.",
      400,
      "DOCUMENT_PROJECT_MISMATCH",
    );
  if (document.liveDocumentUrl)
    throw new SubmissionIntegrityError(
      "Live Google manuscripts must be submitted from Documents so an immutable PDF snapshot and review history are created.",
      409,
      "LIVE_DOCUMENT_REQUIRES_EXPORT",
    );
  const sourceVersion = options.documentVersionId
    ? document.versions.find(({ id }) => id === options.documentVersionId)
    : document.versions[0];
  if (!sourceVersion)
    throw new SubmissionIntegrityError(
      "Select an exact stored document version for this task.",
      400,
      "DOCUMENT_VERSION_REQUIRED",
    );

  const submissionKey = storedVersionSubmissionKey({
    researchId: options.researchId,
    taskId: options.taskId,
    sourceVersionId: sourceVersion.id,
  });
  const existingSnapshot = document.versions.find(
    (version) => version.submissionKey === submissionKey,
  );
  const replay = await assertTaskSubmissionLifecycle(prisma, {
    researchId: options.researchId,
    taskId: options.taskId,
    replayVersionId: existingSnapshot?.id || sourceVersion.id,
  });
  if (replay.duplicateAttempt) {
    const submission = await prisma.taskSubmission.findUniqueOrThrow({
      where: { id: replay.existing!.id },
      include: submissionInclude,
    });
    return {
      project,
      task,
      submission,
      snapshotVersionId: replay.duplicateAttempt.documentVersionId,
      duplicate: true,
    };
  }
  const eligibilityReasons = storedVersionEligibility({
    allowedFileTypes: task.allowedFileTypes,
    taskMilestoneId: task.stageId,
    documentLifecycleStatus: document.lifecycleStatus,
    version: sourceVersion,
  });
  if (eligibilityReasons.length) {
    const reason = eligibilityReasons[0];
    throw new SubmissionIntegrityError(
      reason.message,
      reason.statusCode,
      reason.code,
    );
  }
  const source = await documentService.readStoredVersionFile({
    storageProvider: document.storageProvider,
    storagePath: sourceVersion.storagePath,
    googleDriveFileId: sourceVersion.googleDriveFileId,
    expectedSize: sourceVersion.fileSize,
  });
  validateSubmissionArtifact({
    allowedFileTypes: task.allowedFileTypes,
    fileName: sourceVersion.fileName,
    mimeType: sourceVersion.mimeType,
    buffer: source.buffer,
  });
  const storedSnapshot = await documentService.storeDocumentFile({
    researchId: options.researchId,
    milestoneId: task.stageId,
    title: document.title,
    documentType: `TASK_${task.id}`,
    fileBuffer: source.buffer,
    fileName: sourceVersion.fileName,
    mimeType: sourceVersion.mimeType,
    uploadedBy: options.user.id,
  });
  const checksum = createHash("sha256").update(source.buffer).digest("hex");
  const submittedAt = new Date();

  let recordedSubmission: {
    duplicate: boolean;
    summaryId: string;
    snapshotVersionId: string;
  };
  try {
    recordedSubmission = await runSubmissionTransaction(async (tx) => {
      const committedSnapshot = await tx.documentVersion.findFirst({
        where: { documentId: document.id, submissionKey },
        select: { id: true },
      });
      if (committedSnapshot) {
        const committedReplay = await assertTaskSubmissionLifecycle(tx, {
          researchId: options.researchId,
          taskId: task.id,
          replayVersionId: committedSnapshot.id,
        });
        if (committedReplay.duplicateAttempt)
          return {
            duplicate: true,
            summaryId: committedReplay.existing!.id,
            snapshotVersionId: committedSnapshot.id,
          };
      }
      await assertTaskSubmissionLifecycle(tx, {
        researchId: options.researchId,
        taskId: task.id,
      });
      const currentDocument = await tx.document.findFirst({
        where: {
          id: document.id,
          researchId: options.researchId,
          lifecycleStatus: { in: ["DRAFT", "REVISION_REQUIRED"] },
          versions: {
            some: {
              id: sourceVersion.id,
              status: "ACTIVE",
              isImmutable: false,
            },
          },
        },
        select: {
          lifecycleStatus: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { versionNumber: true },
          },
        },
      });
      if (!currentDocument)
        throw new SubmissionIntegrityError(
          "The document changed before it could be submitted.",
          409,
          "SUBMISSION_STATE_CHANGED",
        );
      const snapshotVersionNumber =
        (currentDocument.versions[0]?.versionNumber || 0) + 1;
      await tx.documentVersion.updateMany({
        where: { documentId: document.id, isImmutable: true, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });
      const snapshotVersion = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          milestoneId: task.stageId,
          versionNumber: snapshotVersionNumber,
          fileName: storedSnapshot.storageResult.fileName,
          mimeType: storedSnapshot.storageResult.mimeType,
          fileSize: BigInt(storedSnapshot.storageResult.sizeBytes),
          storagePath:
            storedSnapshot.storageResult.webViewLink ||
            storedSnapshot.storageResult.storagePath,
          googleDriveFileId:
            storedSnapshot.provider === "GOOGLE_DRIVE"
              ? storedSnapshot.storageResult.fileId
              : null,
          uploadedBy: options.user.id,
          status: "ACTIVE",
          manuscriptStatus: ManuscriptLifecycleStatus.SUBMITTED,
          isImmutable: true,
          contentChecksum: checksum,
          submissionKey,
          submittedBy: options.user.id,
          submittedAt,
          snapshotCreatedAt: submittedAt,
          sourceExternalFileId: sourceVersion.googleDriveFileId,
          sourceModifiedAt: source.sourceModifiedAt,
        },
      });
      await tx.document.update({
        where: { id: document.id },
        data: {
          milestoneId: task.stageId,
          lifecycleStatus: ManuscriptLifecycleStatus.SUBMITTED,
          currentVersion: snapshotVersionNumber,
          storageProvider: storedSnapshot.provider,
          externalFileId: storedSnapshot.storageResult.fileId,
        },
      });
      const review = await configureTaskSubmissionReview(tx, {
        researchId: options.researchId,
        documentId: document.id,
        versionId: snapshotVersion.id,
        milestoneId: task.stageId,
        actorId: options.user.id,
        fromStatus: currentDocument.lifecycleStatus,
        reason: options.note,
      });
      const recorded = await recordTaskSubmissionAttempt(tx, {
        researchId: options.researchId,
        taskId: task.id,
        milestoneId: task.stageId,
        documentId: document.id,
        documentVersionId: snapshotVersion.id,
        submittedBy: options.user.id,
        submittedAt,
        note: options.note,
        lifecycleStatus: review.lifecycleStatus,
      });
      if (!recorded.duplicate) {
        await tx.auditLog.create({
          data: {
            userId: options.user.id,
            action: "CREATE",
            entityType: "TaskSubmissionAttempt",
            entityId: recorded.attempt.id,
            newValues: {
              researchId: options.researchId,
              taskId: task.id,
              documentId: document.id,
              sourceVersionId: sourceVersion.id,
              documentVersionId: snapshotVersion.id,
              attemptNumber: recorded.attempt.attemptNumber,
              submissionKey,
            },
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
          },
        });
      }
      return {
        duplicate: recorded.duplicate,
        summaryId: recorded.summary.id,
        snapshotVersionId: snapshotVersion.id,
      };
    });
  } catch (error) {
    await documentService.cleanupStoredFile(
      storedSnapshot.provider,
      storedSnapshot.storageResult,
    );
    throw error;
  }
  if (recordedSubmission.duplicate)
    await documentService.cleanupStoredFile(
      storedSnapshot.provider,
      storedSnapshot.storageResult,
    );

  const submission = await prisma.taskSubmission.findUniqueOrThrow({
    where: { id: recordedSubmission.summaryId },
    include: submissionInclude,
  });
  return {
    project,
    task,
    submission,
    snapshotVersionId: recordedSubmission.snapshotVersionId,
    duplicate: recordedSubmission.duplicate,
  };
}
