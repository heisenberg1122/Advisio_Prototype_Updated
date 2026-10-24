import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { PdfDocumentPreview } from "@/components/documents/PdfDocumentPreview";

export function SubmittedPdfEvaluations({ sessionId }: { sessionId: string }) {
  const [preview, setPreview] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const { data, error } = useQuery({
    queryKey: ["submitted-pdf-evaluations", sessionId],
    queryFn: () =>
      apiClient.get<{ evaluations: any[] }>(
        `/api/defense-sessions/${sessionId}/pdf-evaluations`,
      ),
    refetchInterval: 15000,
  });
  const open = async (id: string, download: boolean) => {
    setErrorMessage("");
    try {
      const blob = await apiClient.file(
        `/api/defense-sessions/${sessionId}/pdf-evaluations/${id}/content${download ? "?download=1" : ""}`,
      );
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "panelist-evaluation.pdf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else setPreview(url);
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };
  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-bold">Submitted PDF evaluations</h3>
      <p className="mt-1 text-base text-[var(--color-text-secondary)]">
        Panelist drafts are private. Only final submissions appear here.
      </p>
      {error && <p role="alert">Unable to load submissions.</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {!data?.evaluations.length && (
        <p className="mt-3 text-base">No PDF evaluations submitted yet.</p>
      )}
      {data?.evaluations.map((item) => (
        <div
          key={item.id}
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border p-3"
        >
          <span className="flex-1 text-sm font-semibold">
            {item.panelist.firstName} {item.panelist.lastName} · Final and
            locked
          </span>
          <button
            onClick={() => open(item.id, false)}
            className="rounded border px-3 py-2 text-sm"
          >
            Preview
          </button>
          <button
            onClick={() => open(item.id, true)}
            className="rounded border px-3 py-2 text-sm"
          >
            Download
          </button>
        </div>
      ))}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submitted evaluation PDF"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="flex h-[92vh] w-full max-w-5xl flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Final panelist evaluation</h3>
              <button
                className="rounded border px-3 py-2"
                onClick={() => setPreview("")}
              >
                Close preview
              </button>
            </div>
            <PdfDocumentPreview url={preview} />
          </div>
        </div>
      )}
    </section>
  );
}
