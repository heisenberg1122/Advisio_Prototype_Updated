import {
  ManuscriptLifecycleStatus,
  Prisma,
  TaskSubmissionStatus,
  prisma,
} from "../lib/prisma.js";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { documentAccessService } from "./document-access.service.js";
import { createConfiguredAssignmentsForSubmission } from "./reviewer-assignment.service.js";

import { hasActiveWorkflowEnrollment } from "./workflow-enrollment-access.service.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class SubmissionIntegrityError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "SUBMISSION_INTEGRITY_ERROR",
  ) {
    super(message);
    this.name = "SubmissionIntegrityError";
  }
}

export function storedVersionSubmissionKey(options: {
  researchId: string;
  taskId: string;
  sourceVersionId: string;
}) {
  return createHash("sha256")
    .update(
      `stored-version:${options.researchId}:${options.taskId}:${options.sourceVersionId}`,
    )
    .digest("hex");
}

export type SubmissionFileType = "PDF" | "DOC" | "DOCX" | "TXT";

export type SubmissionEligibilityReason = {
  code: string;
  message: string;
  statusCode: number;
};

export type TaskSubmissionAvailability = {
  canSubmit: boolean;
  mode: "INITIAL" | "REVISION" | null;
  currentStatus: TaskSubmissionStatus | null;
  reasons: SubmissionEligibilityReason[];
};

type EligibleDocumentSummary = {
  id: string;
  title: string;
  documentType: string;
  lifecycleStatus: ManuscriptLifecycleStatus;
};

export type StoredVersionSubmissionOption = {
  kind: "STORED_VERSION";
  document: EligibleDocumentSummary;
  version: {
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string;
  };
};

export type GoogleDocsSnapshotSubmissionOption = {
  kind: "GOOGLE_DOC_PDF_SNAPSHOT";
  document: EligibleDocumentSummary;
  snapshot: {
    outputFileType: "PDF";
    outputMimeType: "application/pdf";
    createsImmutableVersion: true;
    requiresExportVerification: true;
  };
};

export type TaskSubmissionOption =
  | StoredVersionSubmissionOption
  | GoogleDocsSnapshotSubmissionOption;

export type TaskSubmissionOptionsResponse = {
  task: {
    id: string;
    title: string;
    milestoneId: string;
    allowedFileTypes: SubmissionFileType[];
  };
  availability: TaskSubmissionAvailability;
  options: TaskSubmissionOption[];
  unavailableOptionReasons: SubmissionEligibilityReason[];
};

const MIME_BY_TYPE: Record<SubmissionFileType, ReadonlySet<string>> = {
  PDF: new Set(["application/pdf"]),
  DOC: new Set(["application/msword", "application/octet-stream"]),
  DOCX: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ]),
  TXT: new Set(["text/plain"]),
};

const MIME_ALIASES = new Map<string, SubmissionFileType>([
  ["application/pdf", "PDF"],
  ["application/msword", "DOC"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "DOCX",
  ],
  ["text/plain", "TXT"],
]);

export function parseAllowedFileTypes(value?: string | null) {
  return new Set(
    String(value || "PDF,DOCX")
      .split(/[\s,|;]+/)
      .map((entry) => entry.trim().replace(/^\./, "").toUpperCase())
      .map((entry) => MIME_ALIASES.get(entry.toLowerCase()) || entry)
      .filter((entry): entry is SubmissionFileType => entry in MIME_BY_TYPE),
  );
}

export function taskSubmissionAvailability(
  status?: TaskSubmissionStatus | null,
): TaskSubmissionAvailability {
  if (!status) {
    return {
      canSubmit: true,
      mode: "INITIAL",
      currentStatus: null,
      reasons: [],
    };
  }
  if (status === TaskSubmissionStatus.REVISION_REQUIRED) {
    return {
      canSubmit: true,
      mode: "REVISION",
      currentStatus: status,
      reasons: [],
    };
  }
  return {
    canSubmit: false,
    mode: null,
    currentStatus: status,
    reasons: [
      {
        code: "INVALID_SUBMISSION_LIFECYCLE",
        message: `This task already has a ${status.toLowerCase().replace(/_/g, " ")} submission. A new attempt is allowed only after revision is required.`,
        statusCode: 409,
      },
    ],
  };
}

export function isDocumentLifecycleSubmittable(
  status: ManuscriptLifecycleStatus,
) {
  return (
    status === ManuscriptLifecycleStatus.DRAFT ||
    status === ManuscriptLifecycleStatus.REVISION_REQUIRED
  );
}

type StoredVersionEligibilityInput = {
  allowedFileTypes?: string | null;
  taskMilestoneId: string;
  documentLifecycleStatus: ManuscriptLifecycleStatus;
  version: {
    status: string;
    isImmutable: boolean;
    milestoneId?: string | null;
    fileName: string;
    mimeType: string;
  };
};

export function storedVersionEligibility(
  input: StoredVersionEligibilityInput,
): SubmissionEligibilityReason[] {
  const reasons: SubmissionEligibilityReason[] = [];
  if (input.version.status !== "ACTIVE") {
    reasons.push({
      code: "DOCUMENT_VERSION_INACTIVE",
      message: "Only an active document version can be submitted.",
      statusCode: 409,
    });
  }
  if (input.version.isImmutable) {
    reasons.push({
      code: "IMMUTABLE_SOURCE_VERSION",
      message:
        "Select an active working version. Submitted snapshots cannot be submitted as a new attempt.",
      statusCode: 409,
    });
  }
  if (
    input.version.milestoneId &&
    input.version.milestoneId !== input.taskMilestoneId
  ) {
    reasons.push({
      code: "DOCUMENT_MILESTONE_MISMATCH",
      message: "This document version belongs to a different milestone.",
      statusCode: 409,
    });
  }
  if (!isDocumentLifecycleSubmittable(input.documentLifecycleStatus)) {
    reasons.push({
      code: "INVALID_DOCUMENT_LIFECYCLE",
      message:
        "This document cannot be submitted again until revision is required.",
      statusCode: 409,
    });
  }
  try {
    validateSubmissionArtifact({
      allowedFileTypes: input.allowedFileTypes,
      fileName: input.version.fileName,
      mimeType: input.version.mimeType,
    });
  } catch (error) {
    if (error instanceof SubmissionIntegrityError) {
      reasons.push({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
    } else {
      throw error;
    }
  }
  return reasons;
}

type LiveGoogleDocumentEligibilityInput = {
  allowedFileTypes?: string | null;
  taskMilestoneId: string;
  documentMilestoneId?: string | null;
  documentLifecycleStatus: ManuscriptLifecycleStatus;
  liveDocumentUrl?: string | null;
  liveExternalFileId?: string | null;
};

export function liveGoogleDocumentEligibility(
  input: LiveGoogleDocumentEligibilityInput,
): SubmissionEligibilityReason[] {
  const reasons: SubmissionEligibilityReason[] = [];
  if (!input.liveDocumentUrl || !input.liveExternalFileId) {
    reasons.push({
      code: "LIVE_DOCUMENT_REQUIRED",
      message:
        "Only a linked live Google document can be submitted as a PDF snapshot.",
      statusCode: 400,
    });
  }
  if (!isDocumentLifecycleSubmittable(input.documentLifecycleStatus)) {
    reasons.push({
      code: "INVALID_LIFECYCLE_STATE",
      message: `A manuscript in ${input.documentLifecycleStatus.replace(/_/g, " ").toLowerCase()} status cannot be submitted again.`,
      statusCode: 409,
    });
  }
  if (
    input.documentMilestoneId &&
    input.documentMilestoneId !== input.taskMilestoneId
  ) {
    reasons.push({
      code: "DOCUMENT_MILESTONE_MISMATCH",
      message: "This document belongs to a different milestone.",
      statusCode: 409,
    });
  }
  try {
    validateSubmissionArtifact({
      allowedFileTypes: input.allowedFileTypes,
      fileName: "immutable-manuscript-snapshot.pdf",
      mimeType: "application/pdf",
    });
  } catch (error) {
    if (error instanceof SubmissionIntegrityError) {
      reasons.push({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
    } else {
      throw error;
    }
  }
  return reasons;
}

function uniqueReasons(reasons: SubmissionEligibilityReason[]) {
  return Array.from(
    new Map(reasons.map((reason) => [reason.code, reason])).values(),
  );
}

function extensionType(fileName: string): SubmissionFileType | null {
  const extension = fileName.split(".").pop()?.trim().toUpperCase();
  return extension && extension in MIME_BY_TYPE
    ? (extension as SubmissionFileType)
    : null;
}

function hasValidSignature(type: SubmissionFileType, buffer: Buffer) {
  if (type === "PDF") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (type === "DOC")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (type === "DOCX")
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2]) &&
      [0x04, 0x06, 0x08].includes(buffer[3])
    );
  return true;
}

export function validateSubmissionArtifact(options: {
  allowedFileTypes?: string | null;
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
}) {
  const allowed = parseAllowedFileTypes(options.allowedFileTypes);
  if (!allowed.size) {
    throw new SubmissionIntegrityError(
      "This task does not have a supported submission format configured.",
      409,
      "UNSUPPORTED_TASK_FILE_CONFIGURATION",
    );
  }
  const fromExtension = extensionType(options.fileName);
  const normalizedMime = options.mimeType.toLowerCase().split(";")[0].trim();
  const fromMime = MIME_ALIASES.get(normalizedMime) || null;
  if (!fromExtension || !allowed.has(fromExtension)) {
    throw new SubmissionIntegrityError(
      `Upload one of the allowed formats: ${Array.from(allowed).join(", ")}.`,
      415,
      "FILE_TYPE_NOT_ALLOWED",
    );
  }
  if (!MIME_BY_TYPE[fromExtension].has(normalizedMime)) {
    throw new SubmissionIntegrityError(
      "The uploaded file extension and content type do not match.",
      415,
      "FILE_TYPE_MISMATCH",
    );
  }
  if (
    fromMime &&
    normalizedMime !== "application/octet-stream" &&
    fromMime !== fromExtension
  ) {
    throw new SubmissionIntegrityError(
      "The uploaded file extension and content type do not match.",
      415,
      "FILE_TYPE_MISMATCH",
    );
  }
  if (options.buffer && !hasValidSignature(fromExtension, options.buffer)) {
    throw new SubmissionIntegrityError(
      `The uploaded file is not a valid ${fromExtension} file.`,
      400,
      "INVALID_FILE_CONTENT",
    );
  }
  return fromExtension;
}

export async function assertTaskWorkflowEnrollment(
  db: Pick<Prisma.TransactionClient, "workflowEnrollment">, userId: string, workflowId: string,
) {
  if (!(await hasActiveWorkflowEnrollment(userId, workflowId, db))) {
    throw new SubmissionIntegrityError("Your access to this workflow was removed by the professor.", 403, "WORKFLOW_ENROLLMENT_REQUIRED");
  }
}

export async function authorizeTaskSubmission(options: {
  user: AuthenticatedUser;
  researchId: string;
  taskId: string;
}) {
  if (!options.user.roles.includes("RESEARCHER")) {
    throw new SubmissionIntegrityError(
      "Only an active student research-group member can submit this requirement.",
      403,
      "SUBMISSION_ROLE_REQUIRED",
    );
  }
  const access = await documentAccessService.forResearch(
    options.user,
    options.researchId,
  );
  if (!access.canSubmitManuscript) {
    throw new SubmissionIntegrityError(
      "You are not an active student member of this research group.",
      access.exists ? 403 : 404,
      "PROJECT_MEMBERSHIP_REQUIRED",
    );
  }
  const project = await prisma.researchProject.findUnique({
    where: { id: options.researchId },
    include: {
      members: {
        where: { leftAt: null },
        select: { userId: true, projectRole: true },
      },
      workflowInstance: {
        include: {
          workflow: { select: { createdBy: true } },
          currentStage: { select: { id: true, sequence: true } },
        },
      },
    },
  });
  if (!project) {
    throw new SubmissionIntegrityError(
      "Research project not found.",
      404,
      "PROJECT_NOT_FOUND",
    );
  }
  if (!project.workflowInstance) {
    throw new SubmissionIntegrityError(
      "This research project does not have an assigned workflow.",
      400,
      "WORKFLOW_REQUIRED",
    );
  }
  await assertTaskWorkflowEnrollment(prisma, options.user.id, project.workflowInstance.workflowId);
  const task = await prisma.workflowTask.findFirst({
    where: {
      id: options.taskId,
      stage: { workflowId: project.workflowInstance.workflowId },
    },
    include: {
      stage: { select: { id: true, sequence: true, requiresApproval: true } },
    },
  });
  if (!task) {
    throw new SubmissionIntegrityError(
      "This task is not part of the project's workflow.",
      400,
      "INVALID_TASK",
    );
  }
  const currentStage = project.workflowInstance.currentStage;
  if (
    currentStage &&
    task.stage.sequence > currentStage.sequence &&
    task.stage.requiresApproval
  ) {
    throw new SubmissionIntegrityError(
      "This task is locked until the project reaches its milestone.",
      409,
      "TASK_NOT_AVAILABLE",
    );
  }
  return { project, task };
}

export async function getTaskSubmissionOptions(options: {
  user: AuthenticatedUser;
  researchId: string;
  taskId: string;
}): Promise<TaskSubmissionOptionsResponse> {
  const { task } = await authorizeTaskSubmission(options);
  const allowedFileTypes = Array.from(
    parseAllowedFileTypes(task.allowedFileTypes),
  );
  const currentSubmission = await prisma.taskSubmission.findUnique({
    where: {
      researchId_taskId: {
        researchId: options.researchId,
        taskId: task.id,
      },
    },
    select: { status: true },
  });
  const availability = taskSubmissionAvailability(currentSubmission?.status);
  if (!allowedFileTypes.length) {
    availability.canSubmit = false;
    availability.mode = null;
    availability.reasons.push({
      code: "UNSUPPORTED_TASK_FILE_CONFIGURATION",
      message:
        "This task does not have a supported submission format configured.",
      statusCode: 409,
    });
  }

  const baseResponse = {
    task: {
      id: task.id,
      title: task.title,
      milestoneId: task.stageId,
      allowedFileTypes,
    },
    availability,
  };
  if (!availability.canSubmit) {
    return {
      ...baseResponse,
      options: [],
      unavailableOptionReasons: availability.reasons,
    };
  }

  const documents = await prisma.document.findMany({
    where: { researchId: options.researchId },
    select: {
      id: true,
      title: true,
      documentType: true,
      milestoneId: true,
      lifecycleStatus: true,
      liveDocumentUrl: true,
      liveExternalFileId: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          fileName: true,
          mimeType: true,
          status: true,
          isImmutable: true,
          milestoneId: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const submissionOptions: TaskSubmissionOption[] = [];
  const unavailableReasons: SubmissionEligibilityReason[] = [];
  for (const document of documents) {
    const summary: EligibleDocumentSummary = {
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      lifecycleStatus: document.lifecycleStatus,
    };
    if (document.liveDocumentUrl || document.liveExternalFileId) {
      const reasons = liveGoogleDocumentEligibility({
        allowedFileTypes: task.allowedFileTypes,
        taskMilestoneId: task.stageId,
        documentMilestoneId: document.milestoneId,
        documentLifecycleStatus: document.lifecycleStatus,
        liveDocumentUrl: document.liveDocumentUrl,
        liveExternalFileId: document.liveExternalFileId,
      });
      if (!reasons.length) {
        submissionOptions.push({
          kind: "GOOGLE_DOC_PDF_SNAPSHOT",
          document: summary,
          snapshot: {
            outputFileType: "PDF",
            outputMimeType: "application/pdf",
            createsImmutableVersion: true,
            requiresExportVerification: true,
          },
        });
      } else {
        unavailableReasons.push(...reasons);
      }
      continue;
    }

    for (const version of document.versions) {
      const reasons = storedVersionEligibility({
        allowedFileTypes: task.allowedFileTypes,
        taskMilestoneId: task.stageId,
        documentLifecycleStatus: document.lifecycleStatus,
        version,
      });
      if (!reasons.length) {
        submissionOptions.push({
          kind: "STORED_VERSION",
          document: summary,
          version: {
            id: version.id,
            versionNumber: version.versionNumber,
            fileName: version.fileName,
            mimeType: version.mimeType,
          },
        });
      } else {
        unavailableReasons.push(...reasons);
      }
    }
  }

  if (!documents.length) {
    unavailableReasons.push({
      code: "NO_PROJECT_DOCUMENTS",
      message: "This research project does not have any documents yet.",
      statusCode: 200,
    });
  } else if (!submissionOptions.length && !unavailableReasons.length) {
    unavailableReasons.push({
      code: "NO_ELIGIBLE_DOCUMENTS",
      message: "No project documents are currently eligible for this task.",
      statusCode: 200,
    });
  }

  return {
    ...baseResponse,
    options: submissionOptions,
    unavailableOptionReasons: uniqueReasons(unavailableReasons),
  };
}

export async function assertTaskSubmissionLifecycle(
  tx: DbClient,
  options: {
    researchId: string;
    taskId: string;
    replayVersionId?: string | null;
  },
) {
  const existing = await tx.taskSubmission.findUnique({
    where: {
      researchId_taskId: {
        researchId: options.researchId,
        taskId: options.taskId,
      },
    },
    include: {
      attempts: options.replayVersionId
        ? { where: { documentVersionId: options.replayVersionId }, take: 1 }
        : false,
    },
  });
  const duplicateAttempt =
    existing && options.replayVersionId && "attempts" in existing
      ? existing.attempts[0] || null
      : null;
  if (duplicateAttempt) return { existing, duplicateAttempt };
  const availability = taskSubmissionAvailability(existing?.status);
  if (!availability.canSubmit) {
    const reason = availability.reasons[0];
    throw new SubmissionIntegrityError(
      reason.message,
      reason.statusCode,
      reason.code,
    );
  }
  return { existing, duplicateAttempt: null };
}

export async function configureTaskSubmissionReview(
  tx: Prisma.TransactionClient,
  options: {
    researchId: string;
    documentId: string;
    versionId: string;
    milestoneId: string;
    actorId: string;
    fromStatus?: ManuscriptLifecycleStatus;
    reason?: string | null;
  },
) {
  await tx.manuscriptStatusEvent.create({
    data: {
      documentId: options.documentId,
      versionId: options.versionId,
      fromStatus: options.fromStatus || ManuscriptLifecycleStatus.DRAFT,
      toStatus: ManuscriptLifecycleStatus.SUBMITTED,
      actorId: options.actorId,
      reason: options.reason?.trim() || null,
    },
  });
  const assignments = await createConfiguredAssignmentsForSubmission(tx, {
    researchId: options.researchId,
    documentId: options.documentId,
    versionId: options.versionId,
    milestoneId: options.milestoneId,
  });
  if (!assignments.length) {
    return {
      assignments,
      lifecycleStatus: ManuscriptLifecycleStatus.SUBMITTED,
    };
  }
  await tx.document.update({
    where: { id: options.documentId },
    data: { lifecycleStatus: ManuscriptLifecycleStatus.IN_REVIEW },
  });
  await tx.documentVersion.update({
    where: { id: options.versionId },
    data: { manuscriptStatus: ManuscriptLifecycleStatus.IN_REVIEW },
  });
  await tx.manuscriptStatusEvent.create({
    data: {
      documentId: options.documentId,
      versionId: options.versionId,
      fromStatus: ManuscriptLifecycleStatus.SUBMITTED,
      toStatus: ManuscriptLifecycleStatus.IN_REVIEW,
      actorId: assignments[0].assignedById,
      reason: "Required manuscript reviewers were assigned.",
    },
  });
  return {
    assignments,
    lifecycleStatus: ManuscriptLifecycleStatus.IN_REVIEW,
  };
}

export async function runSubmissionTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: any) {
      if (
        (error?.code === "P2034" || error?.code === "P2002") &&
        attempt + 1 < maxAttempts
      )
        continue;
      if (error?.code === "P2034" || error?.code === "P2002") {
        throw new SubmissionIntegrityError(
          "Another submission was recorded at the same time. Refresh before trying again.",
          409,
          "CONCURRENT_SUBMISSION",
        );
      }
      throw error;
    }
  }
  throw new SubmissionIntegrityError(
    "The submission could not be recorded safely.",
    409,
    "CONCURRENT_SUBMISSION",
  );
}

export const submissionService = {
  assertTaskSubmissionLifecycle,
  authorizeTaskSubmission,
  configureTaskSubmissionReview,
  getTaskSubmissionOptions,
  liveGoogleDocumentEligibility,
  parseAllowedFileTypes,
  runSubmissionTransaction,
  storedVersionEligibility,
  storedVersionSubmissionKey,
  taskSubmissionAvailability,
  validateSubmissionArtifact,
};
