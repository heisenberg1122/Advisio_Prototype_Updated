import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  readOffline,
  writeOffline,
  type OfflineDraft,
} from "@/lib/offline/store";
import { useOfflineSession } from "./use-offline";

export function downloadDraft(title: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 80) || "Advisio draft"}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OfflineDraftEditor({
  draftKey,
  title,
  onUse,
}: {
  draftKey: string;
  title: string;
  onUse?: (text: string) => void;
}) {
  const { session, loading } = useOfflineSession();
  const [text, setText] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const fieldId = useId();
  useEffect(() => {
    let cancelled = false;
    setLoadedKey("");
    setText("");
    setStatus("");
    setFailed(false);
    if (session)
      readOffline<OfflineDraft>(session, draftKey)
        .then((entry) => {
          if (!cancelled) {
            setText(entry?.value.text || "");
            setLoadedKey(draftKey);
            setStatus(
              entry
                ? "Saved on this device"
                : "Your private draft will save on this device as you type.",
            );
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFailed(true);
            setStatus(
              "Your draft could not be loaded. Try reopening this workspace.",
            );
          }
        });
    return () => {
      cancelled = true;
      sequence.current++;
    };
  }, [session, draftKey]);

  const save = async (value: string) => {
    if (!session) return;
    setText(value);
    setStatus("Saving on this device…");
    setFailed(false);
    const current = ++sequence.current;
    try {
      await writeOffline<OfflineDraft>(session, draftKey, {
        text: value,
        title,
        updatedAt: Date.now(),
      });
      if (current === sequence.current)
        setStatus("Saved on this device · Not submitted");
    } catch {
      if (current === sequence.current) {
        setFailed(true);
        setStatus(
          "Could not save. Keep this page open and export your draft, or retry saving.",
        );
      }
    }
  };

  if (loading)
    return (
      <p className="text-sm" role="status">
        Loading private draft…
      </p>
    );
  if (!session)
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        <Link to="/student/offline" className="font-semibold underline">
          Enable the Offline workspace
        </Link>{" "}
        to save a private preparation draft.
      </p>
    );
  return (
    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <label
        htmlFor={fieldId}
        className="block text-base font-bold text-[var(--color-text-primary)]"
      >
        Private preparation draft
      </label>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Only saved in this browser. Review it online before submitting. Sign-out
        removes local drafts.
      </p>
      <textarea
        id={fieldId}
        value={text}
        disabled={loadedKey !== draftKey}
        onChange={(event) => void save(event.target.value)}
        maxLength={20_000}
        rows={5}
        placeholder="Plan your revisions or prepare your submission note…"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-base text-[var(--color-text-primary)] disabled:opacity-50"
      />
      <p
        role={failed ? "alert" : "status"}
        className={`text-sm ${failed ? "text-red-700 dark:text-red-300" : "text-[var(--color-text-secondary)]"}`}
      >
        {status}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!text}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => downloadDraft(title, text)}
        >
          Export draft
        </button>
        {failed && loadedKey === draftKey && (
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm font-semibold"
            onClick={() => void save(text)}
          >
            Retry saving
          </button>
        )}
        {onUse && (
          <button
            type="button"
            disabled={!text}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={() => onUse(text)}
          >
            Use as submission note
          </button>
        )}
      </div>
    </section>
  );
}
