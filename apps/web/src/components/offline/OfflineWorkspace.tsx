import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { apiClient, ApiError } from "@/lib/api-client";
import { prepareOfflineShell } from "@/lib/offline/register";
import {
  refreshOfflineSnapshot,
  type OfflineSnapshot,
  type SavedFileOption,
} from "@/lib/offline/snapshot";
import {
  clearOfflineStorage,
  enableOfflineStorage,
  listOffline,
  readOffline,
  removeOffline,
  writeOffline,
  type OfflineDraft,
  type OfflineFile,
  type OfflineSession,
} from "@/lib/offline/store";
import { useConnectivity, useOfflineSession } from "./use-offline";
import { downloadDraft, OfflineDraftEditor } from "./OfflineDraftEditor";
import "./offline.css";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;
const safeMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
]);
const dateTime = (value: number) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

export function isOfflineFileUrl(url: string) {
  try {
    const base = new URL(
      import.meta.env.VITE_API_URL || window.location.origin,
    );
    const file = new URL(url, base);
    return file.origin === base.origin && file.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export default function OfflineWorkspace() {
  const { user, token, isOfflineSession, refreshUser, logout } = useAuth();
  const { session, loading } = useOfflineSession();
  const online = useConnectivity();
  const previousOnline = useRef(online);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [savedFiles, setSavedFiles] = useState<Record<string, number>>({});
  const [orphanDrafts, setOrphanDrafts] = useState<
    Array<{ key: string; value: OfflineDraft }>
  >([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  const loadLocal = async (current: OfflineSession) => {
    const [stored, files, drafts] = await Promise.all([
      readOffline<OfflineSnapshot>(current, "snapshot"),
      listOffline<OfflineFile>(current, "file:"),
      listOffline<OfflineDraft>(current, "draft:"),
    ]);
    if (localStorage.getItem("advisio_token") !== current.token) return;
    const value = stored?.value || null;
    setSnapshot(value);
    setSavedFiles(
      Object.fromEntries(files.map((file) => [file.key, file.value.savedAt])),
    );
    const taskKeys = new Set(
      value?.requirements.map((requirement) => requirement.id),
    );
    setOrphanDrafts(
      drafts.filter((draft) => draft.value.text && !taskKeys.has(draft.key)),
    );
  };

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setSavedFiles({});
    setOrphanDrafts([]);
    if (session) {
      // Local reads do not need an internet connection.
      const current = session;
      void (async () => {
        try {
          const stored = await readOffline<OfflineSnapshot>(
            current,
            "snapshot",
          );
          if (cancelled) return;
          await loadLocal(current);
          if (!cancelled)
            setSelected(stored?.value.requirements[0]?.id || "scratchpad");
        } catch {
          if (!cancelled)
            setError(
              "Saved information could not be loaded. Your browser may have cleared its storage.",
            );
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleError = async (reason: unknown) => {
    if (reason instanceof ApiError && [401, 403].includes(reason.statusCode)) {
      await clearOfflineStorage();
      await refreshUser();
    }
    setError(
      reason instanceof Error
        ? reason.message
        : "The offline workspace could not be updated.",
    );
  };

  const refresh = async (enable = false) => {
    if (!token || busy) return;
    setBusy(
      enable ? "Downloading the offline app…" : "Refreshing saved information…",
    );
    setError("");
    setNotice("");
    try {
      const verified = await refreshUser();
      if (!verified)
        throw new Error(
          "Reconnect and verify your session before saving information for offline access.",
        );
      if (enable) await prepareOfflineShell();
      const current = await enableOfflineStorage(verified, token);
      setBusy("Saving your requirements and feedback…");
      await refreshOfflineSnapshot(current);
      await loadLocal(current);
      setNotice(
        "Requirements and feedback saved. Choose the files below that you want available offline. Drafts remain private until you review and submit them online.",
      );
    } catch (reason) {
      await handleError(reason);
    } finally {
      setBusy("");
    }
  };

  const saveFile = async (file: SavedFileOption) => {
    if (!session || busy || !isOfflineFileUrl(file.url)) return;
    setBusy(`Saving ${file.name}…`);
    setError("");
    setNotice("");
    try {
      const blob = await apiClient.file(file.url);
      if (blob.size > MAX_FILE_SIZE)
        throw new Error(
          "This file exceeds the 25 MB offline limit. Download it normally for use outside Advisio.",
        );
      if (!safeMimeTypes.has(blob.type.split(";")[0].toLowerCase()))
        throw new Error(
          "This file type cannot be stored in the Offline workspace. Download the file normally instead.",
        );
      const existing = await listOffline<OfflineFile>(session, "file:");
      const size = existing
        .filter((entry) => entry.key !== `file:${file.id}`)
        .reduce((total, entry) => total + entry.value.blob.size, blob.size);
      if (size > MAX_TOTAL_SIZE)
        throw new Error(
          "Your offline files exceed 100 MB. Remove a saved file and try again.",
        );
      await writeOffline<OfflineFile>(session, `file:${file.id}`, {
        name: file.name,
        blob,
        savedAt: Date.now(),
      });
      await loadLocal(session);
      setNotice(`${file.name} is available offline.`);
    } catch (reason) {
      await handleError(reason);
    } finally {
      setBusy("");
    }
  };

  const openFile = async (file: SavedFileOption) => {
    if (!session) return;
    setError("");
    try {
      const stored = await readOffline<OfflineFile>(session, `file:${file.id}`);
      if (!stored)
        throw new Error(
          "This file is no longer saved on this device. Reconnect and save it again.",
        );
      const url = URL.createObjectURL(stored.value.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = stored.value.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      await handleError(reason);
    }
  };

  const removeFile = async (file: SavedFileOption) => {
    if (!session || busy) return;
    setBusy("Removing saved file…");
    setError("");
    try {
      await removeOffline(session, `file:${file.id}`);
      await loadLocal(session);
    } catch (reason) {
      await handleError(reason);
    } finally {
      setBusy("");
    }
  };

  const clear = async () => {
    if (
      !window.confirm(
        "Remove all offline information, files, and private drafts from this browser? Export any drafts you want to keep first.",
      )
    )
      return;
    setBusy("Removing offline information…");
    setError("");
    try {
      await clearOfflineStorage();
      setSnapshot(null);
      setSavedFiles({});
      setOrphanDrafts([]);
      setNotice("Offline information removed from this browser.");
    } catch (reason) {
      await handleError(reason);
    } finally {
      setBusy("");
    }
  };

  const requirement = snapshot?.requirements.find(
    (item) => item.id === selected,
  );
  const taskLink = requirement
    ? `/student/tasks/${encodeURIComponent(requirement.taskId)}?workflowId=${encodeURIComponent(requirement.workflowId)}${requirement.projectId ? `&projectId=${encodeURIComponent(requirement.projectId)}` : ""}`
    : "";
  const connected = online && !isOfflineSession;

  useEffect(() => {
    const reconnected = online && !previousOnline.current;
    previousOnline.current = online;
    if (reconnected && session && !busy) void refresh();
  }, [online]);

  return (
    <main className="offline-workspace">
      <header className="offline-header">
        <div>
          <p className="offline-eyebrow">ADVISIO · RESEARCHER WORKSPACE</p>
          <h1>Offline workspace</h1>
          <p>
            Read saved requirements, keep selected files, and prepare your next
            submission.
          </p>
        </div>
        <div className="offline-actions">
          {connected && <Link to="/student/tasks">Back to Tasks</Link>}
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <section className="offline-connection" role="status">
        <strong>
          {connected
            ? "Connected"
            : online
              ? "Verify your connection to refresh"
              : "You’re offline"}
        </strong>
        <span>
          {snapshot
            ? `Showing information saved ${dateTime(snapshot.savedAt)} (Manila time).`
            : "Connect once to save your requirements and selected files on this device."}
        </span>
        <span>
          Submissions, approvals, signatures, grades, messages, and bookings
          require an online session.
        </span>
      </section>
      {error && (
        <p className="offline-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="offline-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Checking saved workspace…</p>
      ) : !session ? (
        <section className="offline-card space-y-4">
          <h2>Take your research work offline</h2>
          <p>
            Save requirements and feedback for{" "}
            {user?.firstName || "your account"}, then choose which files to
            keep. This downloads the app so you can reopen this page without
            internet.
          </p>
          <p>
            Use a personal device. Private information and drafts stay in this
            browser and are removed when you sign out, switch account or
            college, or remove offline data. Access ends when your current
            session expires, within seven days. Clearing browser storage can
            also remove your work; export drafts you need to keep.
          </p>
          <button
            className="offline-primary"
            type="button"
            disabled={!online || Boolean(busy) || isOfflineSession}
            onClick={() => void refresh(true)}
          >
            {busy || "Enable on this device"}
          </button>
        </section>
      ) : (
        <>
          <section className="offline-card offline-toolbar">
            <div>
              <h2>Saved for this device</h2>
              <p>
                Refresh while connected to get current access, requirements, and
                feedback. New files need to be saved separately.
              </p>
              <p className="text-sm">
                Offline access expires {dateTime(session.expiresAt)} (Manila
                time).
              </p>
            </div>
            <div className="offline-actions">
              <button
                className="offline-primary"
                type="button"
                disabled={!online || Boolean(busy)}
                onClick={() => void refresh()}
              >
                {busy ||
                  (isOfflineSession
                    ? "Reconnect and refresh"
                    : "Refresh saved information")}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void clear()}
              >
                Remove offline data
              </button>
            </div>
          </section>
          <section className="offline-grid">
            <aside className="offline-card">
              <h2>Requirements</h2>
              <p className="mb-4">
                Statuses and deadlines reflect your last saved information.
              </p>
              <button
                type="button"
                className="offline-task"
                aria-pressed={selected === "scratchpad"}
                onClick={() => setSelected("scratchpad")}
              >
                Research scratchpad
              </button>
              {!snapshot?.requirements.length && (
                <p>
                  No requirements saved yet. Refresh while connected after
                  joining a workflow.
                </p>
              )}
              {snapshot?.requirements.map((task) => (
                <button
                  type="button"
                  className="offline-task"
                  aria-pressed={selected === task.id}
                  key={task.id}
                  onClick={() => setSelected(task.id)}
                >
                  <strong>{task.title}</strong>
                  <span>{task.group}</span>
                  <span>{task.deadline}</span>
                </button>
              ))}
            </aside>
            <article className="offline-card space-y-4">
              {requirement ? (
                <>
                  <p className="offline-eyebrow">
                    {requirement.group} · {requirement.milestone}
                  </p>
                  <h2>{requirement.title}</h2>
                  <p>
                    {requirement.deadline} · Saved status:{" "}
                    {requirement.status.replace(/_/g, " ")}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {requirement.instructions}
                  </p>
                  <p>Accepted files: {requirement.fileTypes}</p>
                  {requirement.feedback.map((text, index) => (
                    <p className="offline-feedback" key={index}>
                      {text}
                    </p>
                  ))}
                  {connected && (
                    <Link
                      to={taskLink}
                      className="inline-block font-bold underline"
                    >
                      Review task and submit online
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <h2>Research scratchpad</h2>
                  <p>
                    Prepare revision notes and ideas here, even while offline.
                  </p>
                </>
              )}
              <OfflineDraftEditor
                key={requirement?.id || "scratchpad"}
                draftKey={requirement?.id || "draft:scratchpad"}
                title={requirement?.title || "Research scratchpad"}
              />
            </article>
          </section>
          <section className="offline-card space-y-4">
            <h2>Documents, guides, and feedback</h2>
            <p>
              Choose “Make available offline” while connected. Each saved file
              is a specific version. Live Google Docs need an online connection.
              Limits: 25 MB per file, 100 MB total.
            </p>
            {!snapshot?.files.length && (
              <p>No documents or guides saved in this snapshot.</p>
            )}
            {snapshot?.files.map((file) => (
              <article className="offline-file" key={file.id}>
                <div>
                  <h3>{file.title}</h3>
                  <p>
                    {file.group} · {file.version}
                  </p>
                  <p>{file.name}</p>
                  {savedFiles[`file:${file.id}`] && (
                    <p className="offline-saved">
                      Available offline · Saved{" "}
                      {dateTime(savedFiles[`file:${file.id}`])}
                    </p>
                  )}
                </div>
                <div className="offline-actions">
                  {savedFiles[`file:${file.id}`] ? (
                    <>
                      <button type="button" onClick={() => void openFile(file)}>
                        Open saved file
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void removeFile(file)}
                      >
                        Remove saved file
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        !connected ||
                        Boolean(busy) ||
                        !isOfflineFileUrl(file.url)
                      }
                      onClick={() => void saveFile(file)}
                    >
                      {isOfflineFileUrl(file.url)
                        ? "Make available offline"
                        : "Live document · Online only"}
                    </button>
                  )}
                </div>
                {file.feedback.length > 0 && (
                  <details className="w-full">
                    <summary>Saved feedback ({file.feedback.length})</summary>
                    {file.feedback.map((text, index) => (
                      <p className="offline-feedback" key={index}>
                        {text}
                      </p>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </section>
          {orphanDrafts.length > 0 && (
            <section className="offline-card space-y-4">
              <h2>Other saved drafts</h2>
              <p>
                These drafts belong to requirements outside the latest saved
                snapshot. You can export your text before removing offline data.
              </p>
              {orphanDrafts.map((draft) => (
                <div key={draft.key} className="offline-file">
                  <strong>{draft.value.title}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      downloadDraft(draft.value.title, draft.value.text)
                    }
                  >
                    Export draft
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
