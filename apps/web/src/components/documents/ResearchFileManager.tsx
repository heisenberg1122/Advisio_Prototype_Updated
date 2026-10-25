"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CircleAlert,
  Download,
  ExternalLink,
  FileText,
  History,
  Link as LinkIcon,
  LockKeyhole,
  Pencil,
  Search,
  Info,
  MessageSquareText,
  Upload,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { Tabs } from "@/components/ui/Tabs";
import {
  documentFileType,
  documentModifiedAt,
  resolveDocumentPreview,
  documentStatusLabel,
  documentWorkspaceCapabilities,
  filterAndSortDocuments,
  googleDocumentPreviewUrl,
  latestDocumentVersion,
  type DocumentWorkspaceFilter,
  type DocumentWorkspaceSort,
  type FileManagerDocument,
  type FileManagerPermissions,
} from "@/lib/document-workspace";

const PdfDocumentPreview = lazy(() =>
  import("./PdfDocumentPreview").then((module) => ({
    default: module.PdfDocumentPreview,
  })),
);

type FileManagerVersion = FileManagerDocument["versions"][number] & {
  manuscriptStatus?: string | null;
  contentChecksum?: string | null;
  submittedAt?: string | null;
  snapshotCreatedAt?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  submitter?: { id: string; firstName: string; lastName: string } | null;
  reviewerAssignments?: Array<{
    id: string;
    status: string;
    reviewType: string;
    completedAt?: string | null;
    reviewer?: { firstName: string; lastName: string } | null;
    review?: {
      recommendation?: string | null;
      overallComment?: string | null;
      submittedAt?: string | null;
      comments: Array<{
        id: string;
        comment: string;
        locationData?: { page?: number; section?: string } | null;
      }>;
    } | null;
  }>;
};

type ResearchFileManagerDocument = Omit<FileManagerDocument, "versions"> & {
  milestoneId?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  versions: FileManagerVersion[];
};

type ResearchFileManagerProps = {
  documents: ResearchFileManagerDocument[];
  selectedDocumentId: string;
  onSelectDocument: (documentId: string) => void;
  onSelectVersion: (versionId: string | null) => void;
  permissions: FileManagerPermissions | null;
  stages: Array<{ id: string; name: string; sequence: number }>;
  taskId?: string | null;
  taskHref?: string;
  requestedVersionId?: string | null;
  onOpenStoredFile: (
    version: FileManagerVersion,
    download?: boolean,
  ) => void | Promise<void>;
  onUpdateMilestone: (documentId: string, milestoneId: string) => void;
  onEditDocument: () => void;
  onCreateDocument: () => void;
  onUploadDocument: () => void;
};

function displayDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function displayModifiedDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  }).format(date);
}

function lifecycleVariant(status: string) {
  if (["APPROVED", "FINALIZED", "APPROVE", "COMPLETED"].includes(status))
    return "success";
  if (
    ["REVISION_REQUIRED", "MINOR_REVISION", "MAJOR_REVISION"].includes(status)
  )
    return "warning";
  if (status === "REJECT") return "danger";
  if (["SUBMITTED", "IN_REVIEW", "ACTIVE"].includes(status)) return "info";
  return "neutral";
}

function DocumentFileIcon({ fileType }: { fileType: string }) {
  const isPdf = fileType === "PDF";
  const isWord = ["DOC", "DOCX"].includes(fileType);
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px] shadow-sm ${isPdf ? "bg-red-500 text-white" : isWord ? "bg-blue-700 text-white" : fileType === "Google Doc" ? "bg-blue-500 text-white" : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"}`}
    >
      <span className="absolute right-0 top-0 h-2 w-2 rounded-bl-sm bg-white/35" />
      {isWord ? (
        <span className="text-sm font-bold">W</span>
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </span>
  );
}

export function ResearchFileManager({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onSelectVersion,
  permissions,
  stages,
  taskId,
  taskHref,
  requestedVersionId,
  onOpenStoredFile,
  onUpdateMilestone,
  onEditDocument,
  onCreateDocument,
  onUploadDocument,
}: ResearchFileManagerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentWorkspaceFilter>("ALL");
  const [sort, setSort] = useState<DocumentWorkspaceSort>("MODIFIED_DESC");
  const [storedPreviewUrl, setStoredPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const [detailTab, setDetailTab] = useState("file-preview");
  const [loadedPreviewKey, setLoadedPreviewKey] = useState("");

  const visibleDocuments = useMemo(
    () => filterAndSortDocuments(documents, { search, filter, sort }),
    [documents, filter, search, sort],
  );
  const selectedDocument =
    visibleDocuments.find((document) => document.id === selectedDocumentId) ||
    null;
  const previewSource = selectedDocument
    ? resolveDocumentPreview(selectedDocument, requestedVersionId)
    : null;
  const selectedVersion = selectedDocument?.versions.find(
    (version) => version.id === previewSource?.version?.id,
  );
  const previewKind = previewSource?.kind || "UNSUPPORTED";
  const displayedStatus =
    selectedVersion?.manuscriptStatus ||
    selectedDocument?.lifecycleStatus ||
    "DRAFT";
  const displayedFileType = selectedVersion
    ? selectedVersion.fileName.split(".").pop()?.toUpperCase() || "Stored file"
    : selectedDocument
      ? documentFileType(selectedDocument)
      : "";
  const previewKey = `${selectedDocument?.id || ""}:${selectedVersion?.id || "working"}`;
  const versions = [...(selectedDocument?.versions || [])].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );
  const feedbackVersion =
    selectedVersion ||
    versions.find((version) =>
      version.reviewerAssignments?.some(
        (item) => item.status === "COMPLETED" && item.review?.recommendation,
      ),
    );
  const feedback = feedbackVersion?.reviewerAssignments || [];
  const decision = feedback.find(
    (item) => item.status === "COMPLETED" && item.review?.recommendation,
  );
  const needsRevision = ["MINOR_REVISION", "MAJOR_REVISION", "REJECT"].includes(
    decision?.review?.recommendation || "",
  );
  const selectVersion = (id: string | null) => {
    setDetailTab("file-preview");
    onSelectVersion(id);
  };
  const capabilities = selectedDocument
    ? documentWorkspaceCapabilities(selectedDocument, permissions)
    : null;
  const previewHeight = "clamp(340px, calc(100dvh - 570px), 660px)";

  useEffect(() => {
    if (!visibleDocuments.length) return;
    if (
      !visibleDocuments.some((document) => document.id === selectedDocumentId)
    )
      onSelectDocument(visibleDocuments[0].id);
  }, [onSelectDocument, selectedDocumentId, visibleDocuments]);

  useEffect(() => {
    setStoredPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
    setLoadedPreviewKey(previewKey);
    if (
      !selectedVersion?.webViewLink ||
      (previewKind !== "PDF" && previewKind !== "TEXT") ||
      !permissions?.canView
    )
      return;
    let cancelled = false;
    let objectUrl = "";
    setPreviewLoading(true);
    apiClient
      .file(selectedVersion.webViewLink)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setStoredPreviewUrl(objectUrl);
      })
      .catch((error: Error) => {
        if (!cancelled)
          setPreviewError(error.message || "Preview could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    selectedVersion?.id,
    selectedVersion?.webViewLink,
    permissions?.canView,
    previewKind,
    previewKey,
    previewRetry,
  ]);

  useEffect(() => {
    setDetailTab("file-preview");
  }, [selectedDocumentId]);

  useEffect(() => {
    if (!requestedVersionId) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`document-version-${requestedVersionId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [requestedVersionId, selectedDocumentId]);

  if (!documents.length) {
    return (
      <EmptyState
        className="m-4 min-h-[320px] sm:m-6"
        icon={FileText}
        title="Your document workspace is ready"
        description={
          permissions?.canManageWorkingDocuments
            ? "Upload a working file, link an existing Google document, or create one. Adding a document does not submit it for review."
            : "Project documents will appear here when a researcher adds them."
        }
        action={
          permissions?.canManageWorkingDocuments ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={onUploadDocument}
                icon={<Upload className="h-4 w-4" />}
              >
                Upload working file
              </Button>
              <Button variant="secondary" onClick={onCreateDocument}>
                Create Google document
              </Button>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {taskId && taskHref && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-primary-light)]/25 px-4 py-2">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                Opened from a task
              </p>
              <p className="sr-only">
                Manage the working file here, then return to Tasks when you are
                ready to submit an eligible version.
              </p>
            </div>
          </div>
          <a
            href={taskHref}
            className="inline-flex min-h-7 shrink-0 items-center justify-center rounded text-xs font-semibold text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
          >
            Return to task
          </a>
        </div>
      )}

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
        <section
          aria-label="Working files"
          className="min-w-0 border-b border-[var(--color-border)] xl:border-b-0 xl:border-r"
        >
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_9rem] xl:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem]">
              <label className="relative col-span-2 block sm:col-span-1">
                <span className="sr-only">Search documents by name</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search files…"
                  className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                />
              </label>
              <label className="relative min-w-0">
                <select
                  aria-label="Document type filter"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as DocumentWorkspaceFilter)
                  }
                  className="h-9 w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-7 text-xs text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                >
                  <option value="ALL">All types</option>
                  <option value="GOOGLE_DOCS">Google Docs</option>
                  <option value="UPLOADED">Uploaded files</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              </label>
              <label className="relative">
                <span className="sr-only">Sort documents</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as DocumentWorkspaceSort)
                  }
                  className="h-9 w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-7 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                >
                  <option value="MODIFIED_DESC">Last modified</option>
                  <option value="MODIFIED_ASC">Oldest modified</option>
                  <option value="NAME_ASC">Filename A–Z</option>
                  <option value="NAME_DESC">Filename Z–A</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]/60 px-4 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] sm:grid-cols-[minmax(0,1fr)_8rem_5rem]">
            <span>
              Name{" "}
              <span className="sr-only">· {visibleDocuments.length} files</span>
            </span>
            <span>Status</span>
            <span className="hidden sm:block">Modified</span>
          </div>
          {visibleDocuments.length ? (
            <div
              role="list"
              aria-label="Project documents"
              className="max-h-[300px] overflow-y-auto xl:max-h-[calc(100dvh-380px)]"
            >
              {visibleDocuments.map((document) => {
                const selected = document.id === selectedDocumentId;
                const latest = latestDocumentVersion(document);
                return (
                  <div
                    key={document.id}
                    role="listitem"
                    className={`border-b border-[var(--color-border)] transition ${selected ? "bg-[var(--color-primary-light)]/45 shadow-[inset_3px_0_0_var(--color-primary)]" : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDocument(document.id)}
                      className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)] sm:grid-cols-[minmax(0,1fr)_8rem_5rem]"
                      aria-current={selected ? "true" : undefined}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <DocumentFileIcon
                          fileType={documentFileType(document)}
                        />
                        <span className="min-w-0">
                          <span
                            className="block truncate text-sm font-semibold text-[var(--color-text-primary)]"
                            title={document.title}
                          >
                            {document.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs leading-5 text-[var(--color-text-secondary)]">
                            {documentFileType(document)} ·{" "}
                            {document.milestone?.name ||
                              latest?.fileName ||
                              "Working file"}
                          </span>
                        </span>
                      </span>
                      <span className="min-w-0">
                        <Tag
                          size="xs"
                          variant={lifecycleVariant(document.lifecycleStatus)}
                        >
                          {documentStatusLabel(document.lifecycleStatus)}
                        </Tag>
                      </span>
                      <span
                        className="hidden text-xs text-[var(--color-text-secondary)] sm:block"
                        title={displayDate(
                          new Date(documentModifiedAt(document)).toISOString(),
                        )}
                      >
                        {displayModifiedDate(documentModifiedAt(document))}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="m-5 min-h-[300px]"
              icon={Search}
              title="No matching documents"
              description="Try another name or file type."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </section>

        <aside
          aria-label="Document details"
          className="min-w-0 bg-[var(--color-surface)]"
        >
          {selectedDocument ? (
            <div>
              <div className="bg-[var(--color-surface)] px-4 pb-2 pt-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold leading-tight text-[var(--color-text-primary)]">
                      {selectedDocument.title}
                    </h2>
                    <p className="sr-only">
                      {displayedFileType} ·{" "}
                      {documentStatusLabel(displayedStatus)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {capabilities?.canOpenGoogle && (
                      <a
                        href={selectedDocument.liveDocumentUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-7 items-center gap-1.5 rounded text-xs font-semibold text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] sm:text-sm"
                      >
                        Open working draft{" "}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {permissions?.canView && selectedVersion?.webViewLink && (
                      <button
                        type="button"
                        aria-label={`Download version ${selectedVersion.versionNumber}`}
                        title={`Download version ${selectedVersion.versionNumber}`}
                        className="inline-flex h-7 items-center gap-1.5 rounded px-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                        onClick={() => onOpenStoredFile(selectedVersion, true)}
                      >
                        <Download className="h-4 w-4" />
                        {!capabilities?.canOpenGoogle && <span>Download</span>}
                      </button>
                    )}
                    {capabilities?.canEditDetails && (
                      <button
                        type="button"
                        aria-label="Edit details"
                        title="Edit document details"
                        className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                        onClick={onEditDocument}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <dl className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <div className="sr-only">
                    <dt className="font-semibold text-[var(--color-text-secondary)]">
                      Last modified
                    </dt>
                    <dd className="mt-1 font-bold text-[var(--color-text-primary)]">
                      {displayDate(
                        new Date(
                          documentModifiedAt(selectedDocument),
                        ).toISOString(),
                      )}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <dt className="font-semibold text-[var(--color-text-secondary)]">
                      Milestone
                    </dt>
                    <dd className="min-w-0 text-[var(--color-text-primary)]">
                      {capabilities?.canUpdateMilestone ? (
                        <select
                          aria-label="Document milestone"
                          value={selectedDocument.milestoneId || ""}
                          onChange={(event) =>
                            onUpdateMilestone(
                              selectedDocument.id,
                              event.target.value,
                            )
                          }
                          className="h-7 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                        >
                          <option value="">No milestone</option>
                          {stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.sequence}. {stage.name}
                            </option>
                          ))}
                        </select>
                      ) : selectedDocument.milestone ? (
                        `${selectedDocument.milestone.sequence}. ${selectedDocument.milestone.name}`
                      ) : (
                        "No milestone"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <label htmlFor="document-preview-version" className="sr-only">
                    Preview version
                  </label>
                  <select
                    id="document-preview-version"
                    value={
                      previewKind === "UNAVAILABLE"
                        ? "unavailable"
                        : selectedVersion?.id || "working"
                    }
                    onChange={(event) =>
                      selectVersion(
                        event.target.value === "working"
                          ? null
                          : event.target.value,
                      )
                    }
                    className="h-8 min-w-0 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                  >
                    {previewKind === "UNAVAILABLE" && (
                      <option value="unavailable" disabled>
                        Requested version unavailable
                      </option>
                    )}
                    {selectedDocument.liveDocumentUrl && (
                      <option value="working">Current working draft</option>
                    )}
                    {!selectedDocument.liveDocumentUrl && !versions.length && (
                      <option value="working">No stored versions</option>
                    )}
                    {versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.isImmutable
                          ? "Submitted version"
                          : "Stored version"}{" "}
                        {version.versionNumber}
                      </option>
                    ))}
                  </select>
                  {selectedVersion?.isImmutable && (
                    <Tag icon={<LockKeyhole className="h-3 w-3" />}>
                      Read-only
                    </Tag>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {selectedVersion
                      ? `${selectedVersion.submittedAt ? "Submitted" : "Saved"} ${displayDate(selectedVersion.submittedAt || selectedVersion.uploadedAt)}`
                      : previewKind === "GOOGLE_DOC"
                        ? "Live document · Editing continues in Google"
                        : ""}
                  </span>
                </div>
                {decision && (
                  <div
                    className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2.5 text-xs ${needsRevision ? "border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]"}`}
                  >
                    <CircleAlert
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 ${needsRevision ? "text-amber-600 dark:text-amber-300" : "text-[var(--color-primary)]"}`}
                    />
                    <p className="shrink-0 font-semibold">
                      {needsRevision &&
                      decision.review?.recommendation !== "REJECT"
                        ? "Changes requested"
                        : documentStatusLabel(decision.review!.recommendation!)}
                    </p>
                    {decision.review?.overallComment && (
                      <p
                        className="min-w-24 flex-1 truncate border-l border-current/20 pl-3"
                        title={decision.review.overallComment}
                      >
                        {decision.review.overallComment}
                      </p>
                    )}
                    <span className="text-[11px] opacity-80">
                      <span className="hidden 2xl:inline">
                        {decision.reviewer
                          ? `${decision.reviewer.firstName} ${decision.reviewer.lastName} · `
                          : ""}
                      </span>
                      v{feedbackVersion?.versionNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailTab("file-feedback")}
                      className="shrink-0 rounded font-semibold text-[var(--color-primary)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                    >
                      View feedback →
                    </button>
                  </div>
                )}
              </div>

              <Tabs
                tabs={[
                  { id: "file-preview", label: "Preview" },
                  {
                    id: "file-feedback",
                    label: "Feedback",
                  },
                  {
                    id: "file-history",
                    label: "Version history",
                  },
                ]}
                activeTab={detailTab}
                onChange={setDetailTab}
                className="mx-4 sm:mx-5 [&_[role=tab]]:px-3 [&_[role=tab]]:py-2.5"
              />
              <section
                hidden={detailTab !== "file-preview"}
                role="tabpanel"
                aria-labelledby="tab-file-preview"
                className="px-4 pb-3 pt-3 sm:px-4"
              >
                <div className="sr-only">
                  <div>
                    <h3
                      id="document-preview-title"
                      className="text-lg font-extrabold text-[var(--color-text-primary)]"
                    >
                      Preview
                    </h3>
                    <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">
                      {previewKind === "GOOGLE_DOC"
                        ? "Live preview; editing continues in Google Docs."
                        : selectedVersion
                          ? `Version ${selectedVersion.versionNumber} · ${selectedVersion.fileName}`
                          : "Selected document version"}
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
                  {previewKind === "UNAVAILABLE" ? (
                    <EmptyState
                      icon={Info}
                      title="This version is unavailable"
                      description="Choose another version above. The working draft has not been substituted for this submission."
                    />
                  ) : !permissions?.canView ? (
                    <EmptyState
                      icon={LockKeyhole}
                      title="Preview access unavailable"
                      description="You do not have permission to view this file."
                    />
                  ) : previewKind === "GOOGLE_DOC" &&
                    selectedDocument.liveDocumentUrl ? (
                    <iframe
                      src={googleDocumentPreviewUrl(
                        selectedDocument.liveDocumentUrl,
                      )}
                      title={`${selectedDocument.title} — current working draft`}
                      className="w-full bg-white"
                      style={{ height: previewHeight }}
                      allow="clipboard-write"
                    />
                  ) : previewLoading || loadedPreviewKey !== previewKey ? (
                    <div
                      className="flex h-64 items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]"
                      aria-live="polite"
                    >
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
                      Loading preview…
                    </div>
                  ) : storedPreviewUrl ? (
                    previewKind === "PDF" ? (
                      <div
                        className="flex min-w-0 flex-col"
                        style={{ height: previewHeight }}
                      >
                        <Suspense
                          fallback={
                            <p role="status" className="p-4 text-sm">
                              Loading PDF reader…
                            </p>
                          }
                        >
                          <PdfDocumentPreview
                            key={previewKey}
                            url={storedPreviewUrl}
                            compact
                          />
                        </Suspense>
                      </div>
                    ) : (
                      <iframe
                        src={storedPreviewUrl}
                        title={`${selectedDocument.title} — version ${selectedVersion?.versionNumber}`}
                        className="w-full bg-white"
                        style={{ height: previewHeight }}
                      />
                    )
                  ) : (
                    <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
                      <FileText className="h-8 w-8 text-[var(--color-primary)]" />
                      <p className="mt-3 text-base font-bold text-[var(--color-text-primary)]">
                        {previewError
                          ? "Preview unavailable"
                          : "Preview is not supported for this file type"}
                      </p>
                      <p className="mt-1 max-w-sm text-base leading-5 text-[var(--color-text-secondary)]">
                        {previewError ||
                          "Open or download the stored version using its authorized file action."}
                      </p>
                      {selectedVersion?.webViewLink && permissions?.canView && (
                        <Button
                          className="mt-4"
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenStoredFile(selectedVersion)}
                        >
                          Open stored file
                        </Button>
                      )}
                      {previewError && (
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewRetry((value) => value + 1)}
                        >
                          Retry preview
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section
                hidden={detailTab !== "file-history"}
                role="tabpanel"
                aria-labelledby="tab-file-history"
                className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3
                      id="document-version-history-title"
                      className="text-lg font-extrabold text-[var(--color-text-primary)]"
                    >
                      Version history
                    </h3>
                    <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">
                      Submitted snapshots are read-only and remain preserved.
                    </p>
                  </div>
                  <Tag variant="neutral">
                    {selectedDocument.versions.length} version
                    {selectedDocument.versions.length === 1 ? "" : "s"}
                  </Tag>
                </div>
                {selectedDocument.versions.length ? (
                  <div className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                    {[...selectedDocument.versions]
                      .sort(
                        (left, right) =>
                          right.versionNumber - left.versionNumber,
                      )
                      .map((version) => (
                        <div
                          key={version.id}
                          id={`document-version-${version.id}`}
                          className={`flex flex-col gap-3 bg-[var(--color-surface)] p-3.5 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center sm:justify-between ${requestedVersionId === version.id ? "ring-2 ring-inset ring-[var(--college-focus-ring)]" : ""}`}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                              {version.isImmutable ? (
                                <LockKeyhole className="h-4 w-4" />
                              ) : (
                                <History className="h-4 w-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                  Version {version.versionNumber} ·{" "}
                                  {version.fileName}
                                </p>
                                {version.isImmutable && (
                                  <Tag size="xs" variant="info">
                                    Read-only submission
                                  </Tag>
                                )}
                              </div>
                              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                                {displayDate(
                                  version.submittedAt || version.uploadedAt,
                                )}
                                {version.milestone
                                  ? ` · ${version.milestone.sequence}. ${version.milestone.name}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          {version.webViewLink && permissions?.canView && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onOpenStoredFile(version)}
                            >
                              Open file
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => selectVersion(version.id)}
                          >
                            Preview version {version.versionNumber}
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-base text-[var(--color-text-secondary)]">
                    This live working document has no frozen versions yet.
                    Submit eligible requirements from Tasks.
                  </p>
                )}
              </section>
              <section
                hidden={detailTab !== "file-feedback"}
                role="tabpanel"
                aria-labelledby="tab-file-feedback"
                className="space-y-3 p-4 sm:p-5"
              >
                {feedback.length ? (
                  <>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Feedback for submitted version{" "}
                      {feedbackVersion?.versionNumber}.
                    </p>
                    {feedback.map((assignment) => (
                      <section
                        key={assignment.id}
                        className="rounded-xl border border-[var(--color-border)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {assignment.reviewer
                                ? `${assignment.reviewer.firstName} ${assignment.reviewer.lastName}`
                                : "Assigned reviewer"}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {documentStatusLabel(assignment.reviewType)} ·{" "}
                              {displayDate(
                                assignment.completedAt ||
                                  assignment.review?.submittedAt,
                              )}
                            </p>
                          </div>
                          <Tag
                            variant={lifecycleVariant(
                              assignment.review?.recommendation ||
                                assignment.status,
                            )}
                          >
                            {documentStatusLabel(
                              assignment.review?.recommendation ||
                                assignment.status,
                            )}
                          </Tag>
                        </div>
                        {assignment.review?.overallComment && (
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text-primary)]">
                            {assignment.review.overallComment}
                          </p>
                        )}
                        {assignment.review?.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="mt-3 rounded-lg bg-[var(--color-surface-subtle)] p-3 text-sm"
                          >
                            <p className="font-semibold text-[var(--color-text-primary)]">
                              {[
                                comment.locationData?.section,
                                comment.locationData?.page
                                  ? `Page ${comment.locationData.page}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">
                              {comment.comment}
                            </p>
                          </div>
                        ))}
                        {feedbackVersion && (
                          <button
                            type="button"
                            className="mt-3 rounded text-sm font-semibold text-[var(--color-primary)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                            onClick={() => selectVersion(feedbackVersion.id)}
                          >
                            View reviewed version{" "}
                            {feedbackVersion.versionNumber} →
                          </button>
                        )}
                      </section>
                    ))}
                  </>
                ) : (
                  <EmptyState
                    icon={MessageSquareText}
                    title="No feedback for this version"
                    description="Reviewer feedback will appear here after this version is submitted and assigned for review."
                  />
                )}
              </section>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs">
                <p className="flex items-start gap-2 text-[var(--color-text-secondary)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  {taskHref
                    ? "Revise the working draft, then submit through the task."
                    : "Submitted versions remain read-only. Edit the working draft to prepare a revision."}
                </p>
                {taskHref && (
                  <Link
                    to={taskHref}
                    className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                  >
                    {needsRevision && taskHref.includes("taskId=")
                      ? "Open revision task →"
                      : taskId
                        ? "Return to task →"
                        : "Open Tasks →"}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              className="m-5 min-h-[420px]"
              icon={FileText}
              title="Select a document"
              description="Choose a file row to view its details, preview, and version history."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
