export type SubmissionFileType = "PDF" | "DOC" | "DOCX" | "TXT";

export type SubmissionUnavailableReason = {
  code: string;
  message: string;
  statusCode: number;
};

export type TaskSubmissionAvailability = {
  canSubmit: boolean;
  mode: "INITIAL" | "REVISION" | null;
  currentStatus: string | null;
  reasons: SubmissionUnavailableReason[];
};

export type SubmissionDocumentSummary = {
  id: string;
  title: string;
  documentType: string;
  lifecycleStatus: string;
};

export type StoredVersionSubmissionOption = {
  kind: "STORED_VERSION";
  document: SubmissionDocumentSummary;
  version: {
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string;
  };
};

export type GoogleDocsSnapshotSubmissionOption = {
  kind: "GOOGLE_DOC_PDF_SNAPSHOT";
  document: SubmissionDocumentSummary;
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
  unavailableOptionReasons: SubmissionUnavailableReason[];
};

export type StableSubmissionKey = {
  scope: string;
  value: string;
};

export function submissionOptionKey(option: TaskSubmissionOption) {
  return option.kind === "STORED_VERSION"
    ? `${option.kind}:${option.document.id}:${option.version.id}`
    : `${option.kind}:${option.document.id}`;
}

export function submissionOptionSummary(option: TaskSubmissionOption) {
  if (option.kind === "STORED_VERSION") {
    return {
      title: option.document.title,
      format: option.version.fileName.split(".").pop()?.toUpperCase() || "FILE",
      version: `Version ${option.version.versionNumber}`,
      fileName: option.version.fileName,
    };
  }
  return {
    title: option.document.title,
    format: option.snapshot.outputFileType,
    version: "New immutable PDF snapshot",
    fileName: `${option.document.title}.pdf`,
  };
}

export function uploadSubmissionSummary(fileName: string) {
  return {
    title: fileName,
    format: fileName.split(".").pop()?.toUpperCase() || "FILE",
    version: "Uploaded file snapshot",
  };
}

export function resolveStableSubmissionKey(
  current: StableSubmissionKey | null,
  scope: string,
  createKey: () => string = () => crypto.randomUUID(),
): StableSubmissionKey {
  if (current?.scope === scope) return current;
  return { scope, value: createKey() };
}

export function allowedUploadExtensions(types: SubmissionFileType[]) {
  return types.map((type) => `.${type.toLowerCase()}`);
}

export function directUploadFileTypes(types: SubmissionFileType[]) {
  return types.filter((type) => ["PDF", "DOC", "DOCX"].includes(type));
}

export function uploadFileCompatibility(
  fileName: string,
  types: SubmissionFileType[],
) {
  const extension = fileName.split(".").pop()?.toUpperCase() || "";
  return {
    compatible: types.includes(extension as SubmissionFileType),
    extension,
    message: types.length
      ? `Choose one of the allowed formats: ${types.join(", ")}.`
      : "This task does not currently accept file uploads.",
  };
}

export function buildDocumentSubmissionRequest(
  option: TaskSubmissionOption,
  context: {
    taskId: string;
    researchId: string;
    milestoneId: string;
    idempotencyKey: string;
    note?: string;
  },
) {
  if (option.kind === "STORED_VERSION") {
    return {
      endpoint: `/api/workflows/tasks/${context.taskId}/submissions`,
      body: {
        researchId: context.researchId,
        documentId: option.document.id,
        documentVersionId: option.version.id,
        note: context.note || undefined,
      },
      idempotencyStrategy: "SERVER_EXACT_VERSION" as const,
    };
  }
  return {
    endpoint: `/api/documents/${option.document.id}/submissions`,
    body: {
      milestoneId: context.milestoneId,
      taskId: context.taskId,
      idempotencyKey: context.idempotencyKey,
      note: context.note || undefined,
    },
    idempotencyStrategy: "CLIENT_STABLE_KEY" as const,
  };
}
