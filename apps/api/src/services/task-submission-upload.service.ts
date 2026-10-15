import { createHash } from "node:crypto";
import { ManuscriptLifecycleStatus, Prisma, prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { documentService } from "./document.service.js";
import {
  createNotificationsOnce,
  recordTaskSubmissionAttempt,
} from "./research-workflow-integration.service.js";

export function taskUploadOperationKey(input: {
  researchId: string;
  taskId: string;
  userId: string;
  clientKey: string;
}) {
  return createHash("sha256")
    .update(`${input.researchId}:${input.taskId}:${input.userId}:${input.clientKey}`)
    .digest("hex");
}

const submissionInclude = {
  document: { include: { versions: { orderBy: { versionNumber: "desc" as const }, take: 1 } } },
  task: true,
  submittedByUser: {
    select: { id: true, firstName: true, lastName: true, universityId: true },
  },
  attempts: { orderBy: { attemptNumber: "desc" as const } },
};

async function existingOperation(creationKey: string) {
  const document = await prisma.document.findUnique({
    where: { creationKey },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!document) return null;
  const submission = await prisma.taskSubmission.findFirst({
    where: { documentId: document.id },
    include: submissionInclude,
  });
  return submission ? { document, version: document.versions[0], submission, duplicate: true } : null;
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
  const project = await prisma.researchProject.findFirst({
    where: {
      id: options.researchId,
      members: {
        some: {
          userId: options.user.id,
          projectRole: { in: ["LEADER", "MEMBER"] },
          leftAt: null,
        },
      },
    },
    include: {
      members: { where: { leftAt: null }, select: { userId: true, projectRole: true } },
      workflowInstance: { include: { workflow: { select: { createdBy: true } } } },
    },
  });
  if (!project) throw Object.assign(new Error("You are not an active student member of this research group."), { statusCode: 403 });

  const task = await prisma.workflowTask.findFirst({
    where: {
      id: options.taskId,
      stage: { workflowId: project.workflowInstance?.workflowId },
    },
  });
  if (!task) throw Object.assign(new Error("This task is not part of the project's workflow."), { statusCode: 400 });

  const creationKey = taskUploadOperationKey({
    researchId: options.researchId,
    taskId: options.taskId,
    userId: options.user.id,
    clientKey: options.clientKey,
  });
  const previous = await existingOperation(creationKey);
  if (previous) return previous;

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
  const { provider, storageResult } = await documentService.storeDocumentFile(payload);
  const checksum = createHash("sha256").update(options.file.buffer).digest("hex");
  let result: any = null;

  for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
    try {
      result = await prisma.$transaction(
        async (tx) => {
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
          const version = await tx.documentVersion.create({
            data: {
              documentId: document.id,
              milestoneId: task.stageId,
              versionNumber: 1,
              fileName: storageResult.fileName,
              mimeType: storageResult.mimeType,
              fileSize: BigInt(storageResult.sizeBytes),
              storagePath: storageResult.webViewLink || storageResult.storagePath,
              googleDriveFileId: provider === "GOOGLE_DRIVE" ? storageResult.fileId : null,
              uploadedBy: options.user.id,
              status: "ACTIVE",
              manuscriptStatus: ManuscriptLifecycleStatus.SUBMITTED,
              isImmutable: true,
              contentChecksum: checksum,
              submittedBy: options.user.id,
              submittedAt: new Date(),
            },
          });
          const recorded = await recordTaskSubmissionAttempt(tx, {
            researchId: options.researchId,
            taskId: task.id,
            milestoneId: task.stageId,
            documentId: document.id,
            documentVersionId: version.id,
            submittedBy: options.user.id,
            submittedAt: new Date(),
            note: options.note,
            lifecycleStatus: ManuscriptLifecycleStatus.SUBMITTED,
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
          return { document, version, submission, duplicate: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error?.code === "P2002") {
        const existing = await existingOperation(creationKey);
        if (existing) {
          await documentService.cleanupStoredFile(provider, storageResult);
          return existing;
        }
      }
      if ((error?.code === "P2002" || error?.code === "P2034") && attempt < 2) continue;
      await documentService.cleanupStoredFile(provider, storageResult);
      throw error;
    }
  }
  if (!result) {
    await documentService.cleanupStoredFile(provider, storageResult);
    throw new Error("Unable to commit the task submission.");
  }

  const recipientIds = new Set<string>();
  const workflowOwnerId = project.workflowInstance?.workflow.createdBy;
  if (workflowOwnerId && workflowOwnerId !== options.user.id) recipientIds.add(workflowOwnerId);
  project.members.forEach((member) => {
    if (member.projectRole === "ADVISER" && member.userId !== options.user.id) recipientIds.add(member.userId);
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
    console.error("Task submission saved, but reviewer notifications failed:", error);
  }
  return result;
}
