import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PdfDocumentPreview } from "./PdfDocumentPreview";

export function SharedManuscriptFeedback({ sessionId }: { sessionId: string }) {
  const { data, error } = useQuery({
    queryKey: ["shared-manuscript-feedback", sessionId],
    queryFn: () =>
      apiClient.get<{ publications: any[] }>(
        `/api/defense-sessions/${sessionId}/manuscript-feedback`,
      ),
    refetchInterval: 15000,
  });
  const [preview, setPreview] = useState(""),
    [message, setMessage] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const open = async (id: string, download: boolean) => {
    setMessage("");
    try {
      const blob = await apiClient.file(
        `/api/defense-sessions/${sessionId}/manuscript-feedback/${id}/content${download ? "?download=1" : ""}`,
      );
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "shared-manuscript-feedback.pdf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else setPreview(url);
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="font-bold">Shared manuscript feedback</h3>
      <p className="mt-1 text-base text-[var(--color-text-secondary)]">
        Only explicitly shared copies appear here. Later private edits do not
        change these snapshots.
      </p>
      {(error || message) && (
        <p role="alert" className="mt-3 text-base text-rose-600">
          {message || "Unable to load shared feedback."}
        </p>
      )}
      {!error && !data && (
        <p role="status" className="mt-3 text-base">
          Loading feedback…
        </p>
      )}
      {data && !data.publications.length && (
        <p className="mt-3 text-base text-[var(--color-text-secondary)]">
          No manuscript feedback has been shared yet.
        </p>
      )}
      {data?.publications.map((item) => (
        <article
          key={item.id}
          className="mt-3 rounded-lg border border-[var(--color-border)] p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="text-sm">
                {item.review.panelist.firstName} {item.review.panelist.lastName}
              </strong>
              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                {item.review.sourceVersion.fileName} · Manuscript v
                {item.review.sourceVersion.versionNumber} · Review revision{" "}
                {item.revision}
              </p>
              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                {item.currentVersion
                  ? "Current published manuscript"
                  : "Earlier manuscript version"}{" "}
                · Shared{" "}
                {new Date(item.publishedAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={() => open(item.id, false)}
              >
                Preview feedback
              </button>
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={() => open(item.id, true)}
              >
                Download feedback
              </button>
            </div>
          </div>
        </article>
      ))}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Shared manuscript feedback preview"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-3"
        >
          <div className="flex h-[94vh] w-full max-w-5xl flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">
                Shared manuscript feedback · Fixed copy
              </h3>
              <button
                className="rounded border px-3 py-2"
                onClick={() => setPreview("")}
              >
                Close feedback preview
              </button>
            </div>
            <PdfDocumentPreview url={preview} />
          </div>
        </div>
      )}
    </section>
  );
}
