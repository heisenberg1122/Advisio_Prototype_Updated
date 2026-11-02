import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DocumentPreviewSkeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api-client";
const PdfDocumentPreview = lazy(() =>
  import("@/components/documents/PdfDocumentPreview").then((module) => ({
    default: module.PdfDocumentPreview,
  })),
);

export type SubmissionDocumentVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  googleDriveFileId?: string | null;
  uploadedAt?: string;
};

export function SubmissionDocumentPreview({
  versions,
  title,
  initialVersionId,
  onVersionChange,
  selectedVersionId,
}: {
  versions: SubmissionDocumentVersion[];
  title: string;
  initialVersionId?: string;
  onVersionChange?: (id: string) => void;
  selectedVersionId?: string;
}) {
  const ordered = useMemo(
    () =>
      [...(versions || [])].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );
  const [versionId, setVersionId] = useState(
    initialVersionId || ordered[0]?.id || "",
  );
  const [retry, setRetry] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeVersionId = selectedVersionId ?? versionId;
  const version = ordered.find((item) => item.id === activeVersionId);

  useEffect(() => {
    setVersionId(initialVersionId || ordered[0]?.id || "");
  }, [initialVersionId, ordered[0]?.id]);

  useEffect(() => {
    onVersionChange?.(activeVersionId);
  }, [activeVersionId, onVersionChange]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewUrl("");
    if (!version?.id) {
      setLoading(false);
      setError("This version does not have an available stored file.");
      return;
    }
    setLoading(true);
    setError("");
    apiClient
      .file(
        `/api/documents/versions/${encodeURIComponent(version.id)}/content`,
        { expectedMimeType: version.mimeType },
      )
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((reason) => {
        if (active)
          setError(reason.message || "The document could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version?.id, version?.googleDriveFileId, version?.mimeType, retry]);

  const mimeType = version?.mimeType || "";
  const canEmbed =
    mimeType === "application/pdf" || mimeType.startsWith("image/");

  return (
    <section className="document-preview-shell submission-preview">
      <header className="document-preview-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
            {version?.fileName || title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {version
              ? `Version ${version.versionNumber}${version.id === initialVersionId ? " · Current submission" : " · Earlier submission"}`
              : "No file"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ordered.length > 1 && (
            <select
              value={version?.id || ""}
              onChange={(event) => {
                if (selectedVersionId !== undefined)
                  onVersionChange?.(event.target.value);
                else setVersionId(event.target.value);
              }}
              className="document-preview-control rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              aria-label="Document version"
            >
              {ordered.map((item) => (
                <option key={item.id} value={item.id}>
                  Version {item.versionNumber}
                </option>
              ))}
            </select>
          )}
          {previewUrl && (
            <>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="document-preview-control rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-primary)]"
              >
                <i className="ti ti-external-link mr-1" aria-hidden="true" />{" "}
                Open file
              </a>
              <a
                href={previewUrl}
                download={version?.fileName || title}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-[var(--college-on-primary)]"
              >
                <i className="ti ti-download mr-1" /> Download
              </a>
            </>
          )}
        </div>
      </header>

      <div className="document-preview-stage submission-preview-stage">
        {loading && (
          <DocumentPreviewSkeleton className="absolute inset-0 h-full w-full" />
        )}
        {!loading && error && (
          <div className="m-auto max-w-md p-8 text-center">
            <i className="ti ti-file-alert text-4xl text-amber-500" />
            <p
              role="alert"
              className="mt-3 text-sm text-[var(--color-text-primary)]"
            >
              {error}
            </p>
            {version?.id && (
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 text-sm font-bold text-[var(--color-primary)]"
              >
                Retry preview
              </button>
            )}
          </div>
        )}
        {!loading && !error && previewUrl && mimeType === "application/pdf" && (
          <Suspense
            fallback={<DocumentPreviewSkeleton className="h-full w-full" />}
          >
            <PdfDocumentPreview key={version?.id} url={previewUrl} compact />
          </Suspense>
        )}
        {!loading && !error && previewUrl && mimeType.startsWith("image/") && (
          <img
            src={previewUrl}
            alt={`Preview of ${version?.fileName || title}`}
            className="m-auto max-h-full max-w-full object-contain p-5"
          />
        )}
        {!loading && !error && previewUrl && !canEmbed && (
          <div className="m-auto max-w-md p-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm">
              <i className="ti ti-file-description text-4xl" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-[var(--color-text-primary)]">
              Preview is not available for this file type
            </h3>
            <p className="mt-2 text-base leading-6 text-[var(--color-text-secondary)]">
              Download this submitted version to review its contents, then add
              your comments and decision alongside it.
            </p>
            <a
              href={previewUrl}
              download={version?.fileName || title}
              className="mt-5 inline-flex rounded-xl bg-[#173f63] px-5 py-3 text-sm font-extrabold text-white"
            >
              <i className="ti ti-download mr-2" /> Download original
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
