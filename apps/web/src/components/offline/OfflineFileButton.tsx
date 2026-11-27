import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  OFFLINE_CHANGED,
  readOffline,
  removeOffline,
} from "@/lib/offline/store";
import { isOfflineFileUrl, saveOfflineFile } from "@/lib/offline/files";
import { useOfflineReadOnly, useOfflineSession } from "./use-offline";

export function OfflineFileButton({
  id,
  name,
  url,
  projectId,
  workflowId,
}: {
  id: string;
  name: string;
  url: string;
  projectId?: string;
  workflowId?: string;
}) {
  const { user } = useAuth();
  const { session } = useOfflineSession();
  const readOnly = useOfflineReadOnly();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSaved(false);
    setError("");
    const load = async () => {
      const file = session
        ? await readOffline(session, `file:${id}`).catch(() => null)
        : null;
      if (!cancelled) setSaved(Boolean(file));
    };
    void load();
    window.addEventListener(OFFLINE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_CHANGED, load);
    };
  }, [session, id]);
  if (
    !user?.roles.some((role) => ["RESEARCHER", "STUDENT"].includes(role)) ||
    !isOfflineFileUrl(url)
  )
    return null;
  const toggle = async () => {
    if (!session) {
      window.dispatchEvent(new Event("advisio:open-offline-settings"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (saved) await removeOffline(session, `file:${id}`);
      else
        await saveOfflineFile(session, {
          id,
          name,
          url,
          projectId,
          workflowId,
        });
      setSaved(!saved);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The file could not be saved on this device.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      <button
        type="button"
        disabled={busy || (readOnly && !saved)}
        aria-pressed={saved}
        onClick={() => void toggle()}
        className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50"
        title={
          saved
            ? "Remove this offline download"
            : "Keep this version on this device"
        }
      >
        {busy
          ? "Saving…"
          : saved
            ? "Available offline"
            : "Make available offline"}
      </button>
      {error && (
        <span
          role="alert"
          className="max-w-xs text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </span>
      )}
    </span>
  );
}
