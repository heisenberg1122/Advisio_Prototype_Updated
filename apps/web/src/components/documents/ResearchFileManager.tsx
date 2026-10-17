"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  Clock3,
  Download,
  ExternalLink,
  File,
  FileText,
  History,
  Link as LinkIcon,
  LockKeyhole,
  Pencil,
  Search,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import {
  documentFileType,
  documentModifiedAt,
  documentPreviewKind,
  documentWorkspaceCapabilities,
  filterAndSortDocuments,
  googleDocumentPreviewUrl,
  latestDocumentVersion,
  taskReturnHref,
  type DocumentWorkspaceFilter,
  type DocumentWorkspaceSort,
  type FileManagerDocument,
  type FileManagerPermissions,
} from "@/lib/document-workspace";

type FileManagerVersion = FileManagerDocument["versions"][number] & {
  manuscriptStatus?: string | null;
  contentChecksum?: string | null;
  submittedAt?: string | null;
  snapshotCreatedAt?: string | null;
  milestone?: { id: string; name: string; sequence: number } | null;
  submitter?: { id: string; firstName: string; lastName: string } | null;
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
  permissions: FileManagerPermissions | null;
  stages: Array<{ id: string; name: string; sequence: number }>;
  projectId: string;
  taskId?: string | null;
  requestedVersionId?: string | null;
  onOpenStoredFile: (
    version: FileManagerVersion,
    download?: boolean,
  ) => void | Promise<void>;
  onUpdateMilestone: (documentId: string, milestoneId: string) => void;
  onEditDocument: () => void;
  onCreateDocument: () => void;
};

function displayDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function lifecycleVariant(status: string) {
  if (status === "APPROVED" || status === "FINALIZED") return "success";
  if (status === "REVISION_REQUIRED") return "warning";
  if (status === "SUBMITTED" || status === "IN_REVIEW") return "info";
  return "neutral";
}

export function ResearchFileManager({
  documents,
  selectedDocumentId,
  onSelectDocument,
  permissions,
  stages,
  projectId,
  taskId,
  requestedVersionId,
  onOpenStoredFile,
  onUpdateMilestone,
  onEditDocument,
  onCreateDocument,
}: ResearchFileManagerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentWorkspaceFilter>("ALL");
  const [sort, setSort] = useState<DocumentWorkspaceSort>("MODIFIED_DESC");
  const [storedPreviewUrl, setStoredPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const visibleDocuments = useMemo(
    () => filterAndSortDocuments(documents, { search, filter, sort }),
    [documents, filter, search, sort],
  );
  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) || null;
  const latestVersion = selectedDocument
    ? (latestDocumentVersion(selectedDocument) as
        | FileManagerVersion
        | undefined)
    : undefined;
  const previewKind = selectedDocument
    ? documentPreviewKind(selectedDocument)
    : "UNSUPPORTED";
  const capabilities = selectedDocument
    ? documentWorkspaceCapabilities(selectedDocument, permissions)
    : null;

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
    if (
      !latestVersion?.webViewLink ||
      (previewKind !== "PDF" && previewKind !== "TEXT") ||
      !permissions?.canView
    )
      return;
    let cancelled = false;
    let objectUrl = "";
    setPreviewLoading(true);
    apiClient
      .file(latestVersion.webViewLink)
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
    latestVersion?.id,
    latestVersion?.webViewLink,
    permissions?.canView,
    previewKind,
  ]);

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
        className="m-5 min-h-[420px]"
        icon={FileText}
        title="No project documents"
        description="Create, link, or upload a real project document to begin this workspace."
        action={
          permissions?.canManageWorkingDocuments ? (
            <Button onClick={onCreateDocument}>New Google Doc</Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="min-h-[680px]">
      {taskId && (
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-primary-light)]/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-2.5">
            <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">
                Opened from a task
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Manage the working file here, then return to Tasks when you are
                ready to submit an eligible version.
              </p>
            </div>
          </div>
          <a
            href={taskReturnHref(projectId, taskId)}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-primary)] px-3 text-xs font-bold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
          >
            Return to task
          </a>
        </div>
      )}

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search documents by name</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents by name"
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] pl-10 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </label>
          <div
            className="inline-flex overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1"
            aria-label="Document type filter"
          >
            {(
              [
                ["ALL", "All files"],
                ["GOOGLE_DOCS", "Google Docs"],
                ["UPLOADED", "Uploaded files"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] ${filter === value ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Sort documents</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as DocumentWorkspaceSort)
              }
              className="h-11 w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-8 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)] lg:w-48"
            >
              <option value="MODIFIED_DESC">Last modified</option>
              <option value="MODIFIED_ASC">Oldest modified</option>
              <option value="NAME_ASC">Filename A–Z</option>
              <option value="NAME_DESC">Filename Z–A</option>
            </select>
            {sort.startsWith("NAME") ? (
              <ArrowDownAZ className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            ) : (
              <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            )}
          </label>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(440px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="min-w-0 border-b border-[var(--color-border)] xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-[minmax(0,1fr)_88px_112px_36px] gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)] sm:grid-cols-[minmax(0,1fr)_110px_130px_44px] sm:px-5">
            <span>Name</span>
            <span>Type</span>
            <span>Modified</span>
            <span className="sr-only">Actions</span>
          </div>
          {visibleDocuments.length ? (
            <div role="list" aria-label="Project documents">
              {visibleDocuments.map((document) => {
                const selected = document.id === selectedDocumentId;
                const latest = latestDocumentVersion(document);
                return (
                  <div
                    key={document.id}
                    role="listitem"
                    className={`grid grid-cols-[minmax(0,1fr)_88px_112px_36px] items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 transition sm:grid-cols-[minmax(0,1fr)_110px_130px_44px] sm:px-5 ${selected ? "bg-[var(--color-primary-light)]/45 shadow-[inset_3px_0_0_var(--color-primary)]" : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDocument(document.id)}
                      className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                      aria-current={selected ? "true" : undefined}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                        {document.liveDocumentUrl ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <File className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {document.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-secondary)]">
                          {document.milestone
                            ? `${document.milestone.sequence}. ${document.milestone.name}`
                            : latest?.fileName || "Project file"}
                        </span>
                      </span>
                    </button>
                    <span className="truncate text-xs font-medium text-[var(--color-text-secondary)]">
                      {documentFileType(document)}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {displayDate(
                        new Date(documentModifiedAt(document)).toISOString(),
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectDocument(document.id)}
                      aria-label={`View details for ${document.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                    >
                      <ExternalLink className="h-4 w-4" />
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
              description="Try another filename or file-type filter. No placeholder files are added."
            />
          )}
        </section>

        <aside className="min-w-0 bg-[var(--color-surface-subtle)]">
          {selectedDocument ? (
            <div>
              <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold text-[var(--color-text-primary)]">
                      {selectedDocument.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Tag variant="neutral">
                        {documentFileType(selectedDocument)}
                      </Tag>
                      <Tag
                        variant={lifecycleVariant(
                          selectedDocument.lifecycleStatus,
                        )}
                      >
                        {selectedDocument.lifecycleStatus.replace(/_/g, " ")}
                      </Tag>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {capabilities?.canOpenGoogle && (
                      <a
                        href={selectedDocument.liveDocumentUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open in Google
                      </a>
                    )}
                    {capabilities?.canOpenStoredVersion && latestVersion && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Download className="h-3.5 w-3.5" />}
                        onClick={() => onOpenStoredFile(latestVersion, true)}
                      >
                        Download
                      </Button>
                    )}
                    {capabilities?.canEditDetails && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={onEditDocument}
                      >
                        Edit details
                      </Button>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
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
                  <div>
                    <dt className="font-semibold text-[var(--color-text-secondary)]">
                      Project milestone
                    </dt>
                    <dd className="mt-1 text-[var(--color-text-primary)]">
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
                          className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-semibold outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--college-focus-ring)]"
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
              </div>

              <section
                aria-labelledby="document-preview-title"
                className="p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3
                      id="document-preview-title"
                      className="text-sm font-extrabold text-[var(--color-text-primary)]"
                    >
                      Preview
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {previewKind === "GOOGLE_DOC"
                        ? "Live preview; editing continues in Google Docs."
                        : latestVersion?.fileName || "Latest available version"}
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  {previewKind === "GOOGLE_DOC" &&
                  selectedDocument.liveDocumentUrl ? (
                    <iframe
                      src={googleDocumentPreviewUrl(
                        selectedDocument.liveDocumentUrl,
                      )}
                      title={`${selectedDocument.title} preview`}
                      className="h-[420px] w-full bg-white"
                      allow="clipboard-write"
                    />
                  ) : previewLoading ? (
                    <div
                      className="flex h-64 items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]"
                      aria-live="polite"
                    >
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
                      Loading preview…
                    </div>
                  ) : storedPreviewUrl ? (
                    <iframe
                      src={storedPreviewUrl}
                      title={`${selectedDocument.title} preview`}
                      className="h-[420px] w-full bg-white"
                    />
                  ) : (
                    <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
                      <FileText className="h-8 w-8 text-[var(--color-primary)]" />
                      <p className="mt-3 text-sm font-bold text-[var(--color-text-primary)]">
                        {previewError
                          ? "Preview unavailable"
                          : "Preview is not supported for this file type"}
                      </p>
                      <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--color-text-secondary)]">
                        {previewError ||
                          "Open or download the stored version using its authorized file action."}
                      </p>
                      {latestVersion?.webViewLink && permissions?.canView && (
                        <Button
                          className="mt-4"
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenStoredFile(latestVersion)}
                        >
                          Open stored file
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section
                aria-labelledby="document-version-history-title"
                className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3
                      id="document-version-history-title"
                      className="text-sm font-extrabold text-[var(--color-text-primary)]"
                    >
                      Version history
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
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
                                <p className="truncate text-xs font-bold text-[var(--color-text-primary)]">
                                  Version {version.versionNumber} ·{" "}
                                  {version.fileName}
                                </p>
                                {version.isImmutable && (
                                  <Tag size="xs" variant="info">
                                    Read-only submission
                                  </Tag>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
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
                              Open
                            </Button>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)]">
                    This live working document has no frozen versions yet.
                    Submit eligible requirements from Tasks.
                  </p>
                )}
              </section>
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
