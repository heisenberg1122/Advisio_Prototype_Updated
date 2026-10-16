import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type StoredVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
};

type ProjectDocument = {
  id: string;
  title: string;
  liveDocumentUrl?: string | null;
  lifecycleStatus: string;
  versions: StoredVersion[];
};

type EligibleDocument = {
  document: ProjectDocument;
  isLiveGoogleDoc: boolean;
  versions: StoredVersion[];
};

type Props = {
  projectId: string;
  taskId: string;
  milestoneId: string;
  allowedFileTypes: string;
  idempotencyKey: string;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmitted: () => void;
  onCancel: () => void;
};

function acceptedExtensions(value: string) {
  return new Set(
    (value || "PDF,DOCX")
      .split(",")
      .map((item) => item.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean),
  );
}

export function TaskDocumentPicker({
  projectId,
  taskId,
  milestoneId,
  allowedFileTypes,
  idempotencyKey,
  note,
  onNoteChange,
  onSubmitted,
  onCancel,
}: Props) {
  const [documentId, setDocumentId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student", "task-existing-documents", projectId],
    queryFn: () =>
      apiClient.get<{ documents: ProjectDocument[] }>(
        `/api/research/${projectId}/documents`,
      ),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const eligibleDocuments = useMemo<EligibleDocument[]>(() => {
    const allowed = acceptedExtensions(allowedFileTypes);
    return (data?.documents || []).flatMap((document) => {
      const isLiveGoogleDoc = Boolean(document.liveDocumentUrl);
      if (isLiveGoogleDoc) {
        // Formal Google Docs submissions are exported as PDF by the existing
        // manuscript lifecycle, so do not offer them for DOCX-only tasks.
        return allowed.has("pdf")
          ? [{ document, isLiveGoogleDoc: true, versions: [] }]
          : [];
      }
      const versions = document.versions.filter((version) => {
        const extension = version.fileName.split(".").pop()?.toLowerCase() || "";
        return allowed.has(extension);
      });
      return versions.length
        ? [{ document, isLiveGoogleDoc: false, versions }]
        : [];
    });
  }, [data, allowedFileTypes]);

  const selected = eligibleDocuments.find((item) => item.document.id === documentId);
  const selectedVersion =
    selected?.versions.find((version) => version.id === versionId) ||
    selected?.versions[0];
  const canSubmitLiveDocument =
    selected?.isLiveGoogleDoc &&
    ["DRAFT", "REVISION_REQUIRED"].includes(selected.document.lifecycleStatus);
  const canSubmit = selected && (selected.isLiveGoogleDoc
    ? canSubmitLiveDocument
    : Boolean(selectedVersion));

  const submit = async () => {
    if (!selected || !canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (selected.isLiveGoogleDoc) {
        // The same endpoint used by Documents freezes the current Google Doc,
        // records its exact version and links it to this workflow task.
        await apiClient.post(`/api/documents/${selected.document.id}/submissions`, {
          milestoneId,
          taskId,
          idempotencyKey,
          note: note.trim() || null,
        });
      } else {
        await apiClient.post(`/api/workflows/tasks/${taskId}/submissions`, {
          researchId: projectId,
          documentId: selected.document.id,
          documentVersionId: selectedVersion!.id,
          note: note.trim() || null,
        });
      }
      onSubmitted();
    } catch (submissionError: any) {
      setError(submissionError?.message || "Unable to submit this document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 border-t border-[var(--color-border)] pt-6">
      <button
        type="button"
        onClick={onCancel}
        className="mb-4 text-xs font-bold text-[var(--color-primary)] hover:underline"
      >
        ← Choose another method
      </button>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
        Submit from Documents
      </h3>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Select a file already saved in this research project. The existing file
        stays in Documents; Advisio records the submitted version for this task.
      </p>

      {isPending ? (
        <p role="status" className="mt-4 text-sm text-[var(--color-text-secondary)]">
          Loading project documents…
        </p>
      ) : isError ? (
        <div role="alert" className="mt-4 rounded-xl border border-[var(--color-border)] p-4 text-sm">
          Could not load your project documents.
          <button type="button" onClick={() => void refetch()} className="ml-2 font-bold text-[var(--color-primary)] underline">
            Retry
          </button>
        </div>
      ) : eligibleDocuments.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-5">
          <p className="font-semibold text-[var(--color-text-primary)]">No compatible documents yet</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Create or upload a document in Documents first. Accepted file types: {allowedFileTypes || "PDF, DOCX"}.
          </p>
          <a
            href={`/student/documents?projectId=${encodeURIComponent(projectId)}&milestoneId=${encodeURIComponent(milestoneId)}&taskId=${encodeURIComponent(taskId)}`}
            className="mt-3 inline-flex text-sm font-bold text-[var(--color-primary)] hover:underline"
          >
            Open Documents →
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="task-existing-document" className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]">
              Select a document
            </label>
            <select
              id="task-existing-document"
              value={documentId}
              onChange={(event) => {
                setDocumentId(event.target.value);
                setVersionId("");
                setError("");
              }}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Choose a project document</option>
              {eligibleDocuments.map(({ document, isLiveGoogleDoc }) => (
                <option key={document.id} value={document.id}>
                  {document.title} {isLiveGoogleDoc ? "· Google Doc (PDF snapshot)" : "· Uploaded file"}
                </option>
              ))}
            </select>
          </div>
          {selected && !selected.isLiveGoogleDoc && (
            <div>
              <label htmlFor="task-existing-version" className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]">
                File version
              </label>
              <select
                id="task-existing-version"
                value={selectedVersion?.id || ""}
                onChange={(event) => setVersionId(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)]"
              >
                {selected.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Version {version.versionNumber} · {version.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selected?.isLiveGoogleDoc && (
            <p className="rounded-lg bg-[var(--color-primary-light)] p-3 text-xs text-[var(--color-text-secondary)]">
              Advisio will create a frozen PDF from your working Google Doc before sending it for review.
              {!canSubmitLiveDocument && (
                <span className="mt-1 block font-semibold">
                  This manuscript is currently {selected.document.lifecycleStatus.replace(/_/g, " ").toLowerCase()}.
                  A new submission is only allowed for drafts or requested revisions.
                </span>
              )}
            </p>
          )}
          <div>
            <label htmlFor="task-existing-note" className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]">
              Note to faculty (optional)
            </label>
            <textarea
              id="task-existing-note"
              value={note}
              maxLength={2000}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)]"
              placeholder="Add a note about this submission"
            />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit selected document"}
          </button>
        </div>
      )}
    </section>
  );
}
