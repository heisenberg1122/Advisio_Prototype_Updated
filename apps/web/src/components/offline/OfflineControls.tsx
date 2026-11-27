import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CloudDownload, WifiOff, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { prepareOfflineShell } from "@/lib/offline/register";
import { refreshOfflineSnapshot } from "@/lib/offline/snapshot";
import {
  clearOfflineStorage,
  enableOfflineStorage,
  listOffline,
  OFFLINE_CHANGED,
  readOffline,
  removeOffline,
  writeOffline,
  type OfflineDraft,
  type OfflineFile,
} from "@/lib/offline/store";
import { OFFLINE_SAVE_ERROR } from "@/lib/offline/cache";
import { exportText } from "@/lib/offline/files";
import {
  useConnectivity,
  useOfflineReadOnly,
  useOfflineSession,
} from "./use-offline";

export function OfflineControls() {
  const { token, refreshUser } = useAuth();
  const { session } = useOfflineSession();
  const online = useConnectivity();
  const readOnly = useOfflineReadOnly();
  const { search } = useLocation();
  const client = useQueryClient();
  const [open, setOpen] = useState(
    () => new URLSearchParams(search).get("offline") === "settings",
  );
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<
    Array<{ key: string; value: OfflineFile }>
  >([]);
  const host = useRef<HTMLDivElement>(null);
  const previousReadOnly = useRef(readOnly);
  const refreshing = useRef(false);

  useEffect(() => {
    const show = () => setOpen(true);
    const failed = () => {
      setError(
        "Some information could not be saved on this device. Check available storage and try refreshing.",
      );
    };
    const outside = (event: MouseEvent) => {
      if (host.current && !host.current.contains(event.target as Node))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("advisio:open-offline-settings", show);
    window.addEventListener(OFFLINE_SAVE_ERROR, failed);
    window.addEventListener("mousedown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("advisio:open-offline-settings", show);
      window.removeEventListener(OFFLINE_SAVE_ERROR, failed);
      window.removeEventListener("mousedown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const saved = session
        ? await listOffline<OfflineFile>(session, "file:").catch(() => [])
        : [];
      if (!cancelled) setFiles(saved);
    };
    void load();
    window.addEventListener(OFFLINE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_CHANGED, load);
    };
  }, [session]);

  const refresh = async (enable = false) => {
    if (!token || refreshing.current) return;
    refreshing.current = true;
    setBusy(
      enable ? "Preparing offline access…" : "Refreshing saved information…",
    );
    setError("");
    setMessage("");
    try {
      const verified = await refreshUser();
      if (!verified)
        throw new Error(
          "Reconnect and verify your session before refreshing saved information.",
        );
      if (enable) await prepareOfflineShell();
      const current = await enableOfflineStorage(verified, token);
      const snapshot = await refreshOfflineSnapshot(current);
      const extras = await Promise.allSettled([
        apiClient.get("/api/workspaces/me"),
        apiClient.get("/api/consultations"),
        apiClient.get("/api/notifications", {
          params: { inbox: "researcher" },
        }),
        apiClient.get("/api/defense-management"),
        apiClient.get("/api/adviser-requests"),
        ...Array.from(
          new Set(
            snapshot.requirements.map((task) => task.projectId).filter(Boolean),
          ),
        ).map((id) => apiClient.get(`/api/research/${id}/defense-result`)),
      ]);
      await client.invalidateQueries();
      await writeOffline(current, "integration-version", 2);
      window.dispatchEvent(new Event("advisio:offline-refreshed"));
      setMessage(
        extras.some((result) => result.status === "rejected")
          ? "Tasks and documents saved. Some dashboard details were unavailable; open those sections while connected to save them."
          : "Ready for offline use. Stay on your usual pages; choose which files to keep beside each document.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Offline information could not be refreshed.",
      );
    } finally {
      refreshing.current = false;
      setBusy("");
    }
  };

  useEffect(() => {
    const reconnected = previousReadOnly.current && !readOnly;
    previousReadOnly.current = readOnly;
    if (reconnected && session) void refresh();
  }, [readOnly]);

  useEffect(() => {
    if (!session || readOnly) return;
    let cancelled = false;
    void readOffline(session, "integration-version")
      .then((record) => {
        if (!cancelled && record?.value !== 2) void refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.tokenHash, readOnly]);

  const clear = async () => {
    if (
      !window.confirm(
        "Remove saved pages, files, and local drafts from this browser? Export any drafts you need first.",
      )
    )
      return;
    setBusy("Removing saved data…");
    setError("");
    try {
      await clearOfflineStorage();
      setMessage("Offline data removed from this browser.");
    } catch {
      setError("Offline data could not be removed. Try again.");
    } finally {
      setBusy("");
    }
  };
  const exportDrafts = async () => {
    if (!session) return;
    try {
      const drafts = (
        await listOffline<OfflineDraft>(session, "draft:")
      ).filter((draft) => draft.value.text);
      if (!drafts.length) {
        setMessage("There are no local drafts to export.");
        return;
      }
      exportText(
        "Advisio local drafts",
        drafts
          .map((draft) => `${draft.value.title}\n\n${draft.value.text}`)
          .join("\n\n--------------------\n\n"),
      );
    } catch {
      setError("Local drafts could not be exported.");
    }
  };
  return (
    <div ref={host} className="relative">
      <button
        type="button"
        aria-label="Offline settings"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]"
      >
        {readOnly ? (
          <WifiOff size={16} aria-hidden="true" />
        ) : (
          <CloudDownload size={16} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {readOnly ? "Offline" : "Offline settings"}
        </span>
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="Offline settings"
          className="fixed inset-x-3 top-20 z-[500] max-h-[75vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-primary)] shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Offline settings</h2>
            <button
              type="button"
              aria-label="Close offline settings"
              onClick={() => setOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm leading-6">
            Keep using Home, Tasks, Documents, and Guides when your connection
            drops. Official actions require internet.
          </p>
          {!session ? (
            <>
              <p className="my-3 text-sm leading-6">
                Enable on a personal device. Saved pages, files, and drafts are
                cleared on sign-out or account/college changes. Offline access
                lasts until your session expires, up to seven days.
              </p>
              <button
                type="button"
                disabled={!online || Boolean(busy)}
                className="my-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => void refresh(true)}
              >
                {busy || "Enable on this device"}
              </button>
            </>
          ) : (
            <>
              <p className="my-3 text-sm">
                Enabled on this device ·{" "}
                {(
                  files.reduce((sum, file) => sum + file.value.blob.size, 0) /
                  1024 /
                  1024
                ).toFixed(1)}{" "}
                MB of 100 MB used
              </p>
              <div className="my-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!online || Boolean(busy)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  onClick={() => void refresh()}
                >
                  {busy ||
                    (readOnly
                      ? "Reconnect and refresh"
                      : "Refresh saved information")}
                </button>
                <button
                  type="button"
                  onClick={() => void exportDrafts()}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold"
                >
                  Export local drafts
                </button>
              </div>
              <p className="text-sm">
                Files are saved as specific versions, up to 25 MB each. Clearing
                browser storage can remove offline work.
              </p>
              {files.map((file) => (
                <div
                  key={file.key}
                  className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm"
                >
                  <span className="min-w-0 break-words">{file.value.name}</span>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    aria-label={`Remove offline copy of ${file.value.name}`}
                    className="shrink-0 underline"
                    onClick={() =>
                      void removeOffline(session, file.key).catch(() =>
                        setError("The saved file could not be removed."),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void clear()}
                className="mt-4 text-sm font-semibold underline"
              >
                Remove offline data
              </button>
            </>
          )}
          {message && (
            <p role="status" className="mt-3 text-sm leading-6">
              {message}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-3 text-sm leading-6 text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
