import { useEffect, useMemo, useState } from "react";
import { DocumentPreviewSkeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api-client";

type DocumentVersion = {
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
}: {
  versions: DocumentVersion[];
  title: string;
}) {
  const ordered = useMemo(
    () =>
      [...(versions || [])].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );
  const [versionId, setVersionId] = useState(ordered[0]?.id || "");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const version = ordered.find((item) => item.id === versionId) || ordered[0];

  useEffect(() => {
    setVersionId(ordered[0]?.id || "");
  }, [ordered[0]?.id]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewUrl("");
    if (!version?.googleDriveFileId) {
      setLoading(false);
      setError("This version does not have an available stored file.");
      return;
    }
    setLoading(true);
    setError("");
    apiClient.file(
      `/api/documents/files/${encodeURIComponent(version.googleDriveFileId)}`,
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
  }, [version?.googleDriveFileId, version?.mimeType]);

  const mimeType = version?.mimeType || "";
  const canEmbed =
    mimeType === "application/pdf" || mimeType.startsWith("image/");

  return (
    <section className="document-preview-shell overflow-hidden rounded-2xl border shadow-sm">
      <header className="document-preview-toolbar flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[var(--color-text-primary)]">
            {version?.fileName || title}
          </p>
          <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">
            {version
              ? `Version ${version.versionNumber} · ${version.mimeType}`
              : "No file"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ordered.length > 1 && (
            <select
              value={version?.id || ""}
              onChange={(event) => setVersionId(event.target.value)}
              className="document-preview-control rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-base font-bold"
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
                className="document-preview-control rounded-lg border px-3 py-2 text-sm font-extrabold"
              >
                <i className="ti ti-maximize mr-1" /> Full screen
              </a>
              <a
                href={previewUrl}
                download={version?.fileName || title}
                className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-extrabold text-white"
              >
                <i className="ti ti-download mr-1" /> Download
              </a>
            </>
          )}
        </div>
      </header>

      <div className="document-preview-stage relative grid min-h-[640px] place-items-center">
        {loading && (
          <DocumentPreviewSkeleton className="absolute inset-0 min-h-[640px] w-full" />
        )}
        {!loading && error && (
          <div className="max-w-md p-8 text-center">
            <i className="ti ti-file-alert text-4xl text-amber-500" />
            <p className="mt-3 text-base font-bold text-[var(--color-text-primary)]">{error}</p>
          </div>
        )}
        {!loading && !error && previewUrl && mimeType === "application/pdf" && (
          <iframe
            title={`Preview of ${version?.fileName || title}`}
            src={previewUrl}
            className="document-preview-embed h-[72vh] min-h-[640px] w-full border-0"
          />
        )}
        {!loading && !error && previewUrl && mimeType.startsWith("image/") && (
          <img
            src={previewUrl}
            alt={`Preview of ${version?.fileName || title}`}
            className="max-h-[72vh] max-w-full object-contain p-5"
          />
        )}
        {!loading && !error && previewUrl && !canEmbed && (
          <div className="max-w-md p-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm">
              <i className="ti ti-file-description text-4xl" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-[var(--color-text-primary)]">
              Preview is not available for this file type
            </h3>
            <p className="mt-2 text-base leading-6 text-[var(--color-text-secondary)]">
              Download the original file to review it. DOCX preview conversion
              can be added as the next phase.
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
