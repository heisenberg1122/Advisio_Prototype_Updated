import { useEffect, useRef, useState } from "react";
import {
  readOffline,
  removeOffline,
  writeOffline,
  type OfflineDraft,
} from "@/lib/offline/store";
import { exportText } from "@/lib/offline/files";
import { useOfflineReadOnly, useOfflineSession } from "./use-offline";

export function requirementFingerprint(task: any) {
  return JSON.stringify([
    task?.title,
    task?.instructions,
    task?.allowedFileTypes,
    task?.stage?.description,
    task?.stage?.targetCompletionDate,
    task?.locked,
  ]);
}

export function useTaskNoteDraft({
  draftKey,
  title,
  fingerprint,
  initialNote,
  value,
  onChange,
}: {
  draftKey: string | null;
  title: string;
  fingerprint: string;
  initialNote: string;
  value: string;
  onChange: (text: string) => void;
}) {
  const { session, loading } = useOfflineSession();
  const readOnly = useOfflineReadOnly();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setStatus("");
    setFailed(false);
    setNeedsReview(false);
    if (loading) return;
    if (!session || !draftKey) {
      setReady(true);
      return;
    }
    void readOffline<OfflineDraft>(session, draftKey)
      .then((record) => {
        if (cancelled) return;
        const draft = record?.value;
        onChange(draft?.text ?? initialNote);
        setNeedsReview(
          Boolean(
            draft?.text &&
            (draft.needsReview ||
              draft.requirementFingerprint !== fingerprint ||
              draft.text.length > 2000),
          ),
        );
        setStatus(
          draft
            ? "Saved on this device · Not submitted"
            : "Your note will save on this device as you type.",
        );
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          setFailed(true);
          setStatus(
            "The saved draft could not be loaded. Export your current note before leaving this page.",
          );
        }
      });
    return () => {
      cancelled = true;
      sequence.current++;
    };
  }, [session?.tokenHash, draftKey, fingerprint, loading]);

  const save = async (text: string, review = needsReview || readOnly) => {
    onChange(text);
    if (!session || !draftKey || !ready) return;
    const current = ++sequence.current;
    setStatus("Saving on this device…");
    setFailed(false);
    setNeedsReview(review);
    try {
      await writeOffline<OfflineDraft>(session, draftKey, {
        text,
        title,
        updatedAt: Date.now(),
        requirementFingerprint: fingerprint,
        needsReview: review,
      });
      if (current === sequence.current)
        setStatus("Saved on this device · Not submitted");
    } catch {
      if (current === sequence.current) {
        setFailed(true);
        setStatus(
          "Could not save this note. Keep this page open and export it, or retry saving.",
        );
      }
    }
  };
  const clear = async () => {
    if (session && draftKey) await removeOffline(session, draftKey);
    setStatus("");
    setNeedsReview(false);
  };
  const controls = (
    <div className="mt-2 space-y-2 text-sm text-[var(--color-text-secondary)]">
      {session ? (
        <>
          <p role={failed ? "alert" : "status"}>{status}</p>
          {needsReview && (
            <p role="status" className="font-semibold">
              Review this saved note against the current requirement before
              submitting. Your draft may have been prepared offline or the
              requirement may have changed.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!value}
              className="font-semibold underline disabled:opacity-50"
              onClick={() => exportText(title, value)}
            >
              Export draft
            </button>
            {failed && (
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void save(value)}
              >
                Retry saving
              </button>
            )}
            {needsReview && !readOnly && (
              <button
                type="button"
                disabled={value.length > 2000}
                className="font-semibold underline disabled:opacity-50"
                onClick={() => void save(value, false)}
              >
                I’ve reviewed this draft
              </button>
            )}
          </div>
          {value.length > 2000 && (
            <p role="alert">
              This saved draft exceeds the 2,000-character submission-note
              limit. Export a copy before shortening it.
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          className="font-semibold underline"
          onClick={() =>
            window.dispatchEvent(new Event("advisio:open-offline-settings"))
          }
        >
          Enable offline saving for this note
        </button>
      )}
    </div>
  );
  return {
    change: (text: string) => void save(text),
    clear,
    needsReview,
    failed,
    ready: !loading && ready,
    controls,
  };
}
