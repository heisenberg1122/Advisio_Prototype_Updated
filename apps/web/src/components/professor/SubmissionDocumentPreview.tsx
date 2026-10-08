import { useEffect, useMemo, useState } from "react";
import { DocumentPreviewSkeleton } from "@/components/ui/Skeleton";

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
    if (!version?.googleDriveFileId) {
      setPreviewUrl("");
      setError("This version does not have an available stored file.");
      return;
    }
    setLoading(true);
    setError("");
    const token = localStorage.getItem("advisio_token");
    fetch(`/api/documents/files/${version.googleDriveFileId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          const message =
            typeof detail.error === "string"
              ? detail.error
              : typeof detail.message === "string"
                ? detail.message
                : "The document could not be loaded.";
          throw new Error(message);
        }
        return response.blob();
      })
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
  }, [version?.googleDriveFileId]);

  const mimeType = version?.mimeType || "";
  const canEmbed =
    mimeType === "application/pdf" || mimeType.startsWith("image/");

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#102f49]">
            {version?.fileName || title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-[#173f63]"
              >
                <i className="ti ti-maximize mr-1" /> Full screen
              </a>
              <a
                href={previewUrl}
                download={version?.fileName || title}
                className="rounded-lg bg-[#173f63] px-3 py-2 text-xs font-extrabold text-white"
              >
                <i className="ti ti-download mr-1" /> Download
              </a>
            </>
          )}
        </div>
      </header>

      <div className="relative grid min-h-[640px] place-items-center bg-slate-100">
        {loading && (
          <DocumentPreviewSkeleton className="absolute inset-0 min-h-[640px] w-full" />
        )}
        {!loading && error && (
          <div className="max-w-md p-8 text-center">
            <i className="ti ti-file-alert text-4xl text-amber-500" />
            <p className="mt-3 text-sm font-bold text-slate-700">{error}</p>
          </div>
        )}
        {!loading && !error && previewUrl && mimeType === "application/pdf" && (
          <iframe
            title={`Preview of ${version?.fileName || title}`}
            src={previewUrl}
            className="h-[72vh] min-h-[640px] w-full border-0 bg-white"
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
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#173f63] shadow-sm">
              <i className="ti ti-file-description text-4xl" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-[#102f49]">
              Preview is not available for this file type
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
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
