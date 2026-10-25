export type DocumentWorkspaceFilter = "ALL" | "GOOGLE_DOCS" | "UPLOADED";

export type DocumentWorkspaceSort =
  | "MODIFIED_DESC"
  | "MODIFIED_ASC"
  | "NAME_ASC"
  | "NAME_DESC";

export type FileManagerDocument = {
  id: string;
  title: string;
  documentType: string;
  lifecycleStatus: string;
  liveDocumentUrl?: string | null;
  updatedAt: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string;
    webViewLink?: string;
    uploadedAt: string;
    isImmutable?: boolean;
  }>;
};

export type FileManagerPermissions = {
  canView: boolean;
  canManageWorkingDocuments: boolean;
};

export function extractGoogleDocumentId(rawUrl?: string | null) {
  const value = rawUrl?.trim() || "";
  return (
    value.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    value.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
    null
  );
}

export function googleDocumentPreviewUrl(rawUrl: string) {
  const id = extractGoogleDocumentId(rawUrl);
  if (!id) return rawUrl;
  return rawUrl.includes("docs.google.com")
    ? `https://docs.google.com/document/d/${id}/preview`
    : `https://drive.google.com/file/d/${id}/preview`;
}

export function latestDocumentVersion(document: FileManagerDocument) {
  return [...document.versions].sort(
    (left, right) => right.versionNumber - left.versionNumber,
  )[0];
}

export function documentFileType(document: FileManagerDocument) {
  if (document.liveDocumentUrl) return "Google Doc";
  const version = latestDocumentVersion(document);
  const extension = version?.fileName.split(".").pop()?.trim().toUpperCase();
  return extension || "Uploaded file";
}

export function documentModifiedAt(document: FileManagerDocument) {
  const version = latestDocumentVersion(document);
  const documentTime = new Date(document.updatedAt).getTime();
  const versionTime = version ? new Date(version.uploadedAt).getTime() : 0;
  return Math.max(
    Number.isFinite(documentTime) ? documentTime : 0,
    Number.isFinite(versionTime) ? versionTime : 0,
  );
}

export function filterAndSortDocuments<T extends FileManagerDocument>(
  documents: T[],
  options: {
    search: string;
    filter: DocumentWorkspaceFilter;
    sort: DocumentWorkspaceSort;
  },
) {
  const search = options.search.trim().toLocaleLowerCase();
  return documents
    .filter((document) => {
      if (options.filter === "GOOGLE_DOCS" && !document.liveDocumentUrl)
        return false;
      if (options.filter === "UPLOADED" && document.liveDocumentUrl)
        return false;
      return !search || document.title.toLocaleLowerCase().includes(search);
    })
    .sort((left, right) => {
      if (options.sort === "NAME_ASC")
        return left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        });
      if (options.sort === "NAME_DESC")
        return right.title.localeCompare(left.title, undefined, {
          sensitivity: "base",
        });
      const difference = documentModifiedAt(left) - documentModifiedAt(right);
      return options.sort === "MODIFIED_ASC" ? difference : -difference;
    });
}

export function resolveDocumentSelection<T extends { id: string }>(
  documents: T[],
  requestedDocumentId?: string | null,
  currentDocumentId?: string | null,
) {
  if (
    requestedDocumentId &&
    documents.some((document) => document.id === requestedDocumentId)
  )
    return requestedDocumentId;
  if (
    currentDocumentId &&
    documents.some((document) => document.id === currentDocumentId)
  )
    return currentDocumentId;
  return documents[0]?.id || "";
}

export function documentPreviewKind(document: FileManagerDocument) {
  return resolveDocumentPreview(document).kind;
}

/** A requested submission must never silently display a newer or live draft. */
export function resolveDocumentPreview(
  document: FileManagerDocument,
  versionId?: string | null,
) {
  const version = versionId
    ? document.versions.find((item) => item.id === versionId)
    : document.liveDocumentUrl
      ? undefined
      : latestDocumentVersion(document);
  if (versionId && !version)
    return { kind: "UNAVAILABLE" as const, version: undefined };
  if (!versionId && document.liveDocumentUrl)
    return { kind: "GOOGLE_DOC" as const, version: undefined };
  const mimeType = version?.mimeType.toLowerCase();
  if (mimeType === "application/pdf") return { kind: "PDF" as const, version };
  if (mimeType === "text/plain") return { kind: "TEXT" as const, version };
  return { kind: "UNSUPPORTED" as const, version };
}

export function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    IN_REVIEW: "In review",
    REVISION_REQUIRED: "Changes requested",
    APPROVED: "Approved",
    FINALIZED: "Finalized",
    ACTIVE: "Awaiting review",
    COMPLETED: "Review completed",
    REVOKED: "Revoked",
    REASSIGNED: "Reassigned",
    SUPERSEDED: "Superseded",
    MINOR_REVISION: "Minor changes requested",
    MAJOR_REVISION: "Major changes requested",
    APPROVE: "Approved",
    REJECT: "Not accepted",
  };
  return (
    labels[status] ||
    status
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^\w/, (letter) => letter.toUpperCase())
  );
}

export function documentWorkspaceCapabilities(
  document: FileManagerDocument,
  permissions: FileManagerPermissions | null,
) {
  return {
    canOpenGoogle: Boolean(document.liveDocumentUrl && permissions?.canView),
    canEditDetails: Boolean(
      document.liveDocumentUrl && permissions?.canManageWorkingDocuments,
    ),
    canUpdateMilestone: Boolean(
      document.liveDocumentUrl && permissions?.canManageWorkingDocuments,
    ),
    canOpenStoredVersion: Boolean(
      permissions?.canView && latestDocumentVersion(document)?.webViewLink,
    ),
  };
}

export function taskReturnHref(projectId: string, taskId: string) {
  const query = new URLSearchParams({ projectId, taskId });
  return `/student/tasks?${query.toString()}`;
}
