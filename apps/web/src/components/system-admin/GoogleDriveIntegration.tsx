"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import "./system-admin.css";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/Skeleton";
import { DriveStorageMetrics } from "./DriveStorageMetrics";
import { STORAGE_FRESH_MS, type StorageQuota } from "./drive-storage-metrics";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  LogIn,
  RefreshCw,
  Unplug,
  UserRound,
  X,
} from "lucide-react";

type DriveStatus = {
  oauthConfigured: boolean;
  encryptionConfigured: boolean;
  connected: boolean;
  status:
    | "DISCONNECTED"
    | "HEALTHY"
    | "DEGRADED"
    | "ACTION_REQUIRED"
    | "FOLDER_INACCESSIBLE"
    | "MISCONFIGURED";
  account: {
    email: string | null;
    displayName: string | null;
    photoUrl: string | null;
  } | null;
  rootFolder: {
    id: string;
    name: string | null;
    sharedDriveId: string | null;
  } | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  error: { code: string; message: string | null } | null;
  managedStorage: { fileCount: number; bytes: number };
  quota?: StorageQuota | null;
  maxUploadSize?: string | null;
};

const STATUS_META: Record<
  DriveStatus["status"],
  { label: string; dot: string; panel: string; icon: typeof CheckCircle2 }
> = {
  HEALTHY: {
    label: "Healthy",
    dot: "bg-emerald-500",
    panel:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  DEGRADED: {
    label: "Degraded",
    dot: "bg-amber-500",
    panel:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    icon: AlertTriangle,
  },
  ACTION_REQUIRED: {
    label: "Action required",
    dot: "bg-rose-500",
    panel:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    icon: AlertTriangle,
  },
  FOLDER_INACCESSIBLE: {
    label: "Folder inaccessible",
    dot: "bg-rose-500",
    panel:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    icon: FolderOpen,
  },
  MISCONFIGURED: {
    label: "Setup required",
    dot: "bg-slate-400",
    panel:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    icon: AlertTriangle,
  },
  DISCONNECTED: {
    label: "Not connected",
    dot: "bg-slate-400",
    panel:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    icon: Unplug,
  },
};

function dateLabel(value: string | null) {
  if (!value) return "Not checked yet";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function GoogleDriveIntegration({
  compact = false,
  row = false,
  onManage,
}: {
  compact?: boolean;
  /** One-line status for the Overview page. */
  row?: boolean;
  onManage?: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const statusQuery = useQuery({
    queryKey: ["google-drive-integration"],
    queryFn: async () => {
      const data = await apiClient.get<DriveStatus>(
        "/api/integrations/google-drive/status",
      );
      if (
        !data.connected ||
        (data.quota?.attemptedAt &&
          Date.now() - new Date(data.quota.attemptedAt).getTime() <
            STORAGE_FRESH_MS)
      )
        return data;
      try {
        return await apiClient.post<DriveStatus>(
          "/api/integrations/google-drive/storage-refresh",
          { force: false },
        );
      } catch {
        return {
          ...data,
          quota: {
            limit: null,
            usage: null,
            usageInDrive: null,
            checkedAt: null,
            attemptedAt: null,
            ...data.quota,
            error:
              "Storage refresh failed. Showing the last available figures.",
          },
        };
      }
    },
    staleTime: 60_000,
    refetchInterval: 15 * 60_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const result = new URLSearchParams(window.location.search).get("drive");
    if (result === "connected")
      setNotice(
        "Google Drive connected and its Advisio storage folder is ready.",
      );
    if (result === "cancelled")
      setNotice("Google Drive connection was cancelled.");
    if (result === "connection_failed" || result === "invalid_callback")
      setNotice(
        "Google Drive could not be connected. Review the OAuth settings and try again.",
      );
  }, []);

  const connect = useMutation({
    mutationFn: () =>
      apiClient.post<{ authorizationUrl: string }>(
        "/api/integrations/google-drive/connect",
      ),
    onSuccess: ({ authorizationUrl }) =>
      window.location.assign(authorizationUrl),
    onError: (error: Error) => setNotice(error.message),
  });
  const health = useMutation({
    mutationFn: () =>
      apiClient.post<DriveStatus>(
        "/api/integrations/google-drive/health-check",
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive-integration"], data);
      setNotice(
        data.status === "HEALTHY"
          ? "Google Drive passed the connection test."
          : data.error?.message || "The connection needs attention.",
      );
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const [storageError, setStorageError] = useState<string | null>(null);
  const storageRefresh = useMutation({
    mutationFn: () =>
      apiClient.post<DriveStatus>(
        "/api/integrations/google-drive/storage-refresh",
        { force: true },
      ),
    onSuccess: (data) => {
      setStorageError(null);
      queryClient.setQueryData(["google-drive-integration"], data);
    },
    onError: () =>
      setStorageError(
        "Storage refresh failed. Showing the last available figures.",
      ),
  });
  const disconnect = useMutation({
    mutationFn: () =>
      apiClient.post<DriveStatus>("/api/integrations/google-drive/disconnect"),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-drive-integration"], data);
      setConfirmDisconnect(false);
      setNotice(
        "Google Drive was disconnected. Existing Drive files were not deleted.",
      );
    },
    onError: (error: Error) => setNotice(error.message),
  });

  if (row && statusQuery.isLoading)
    return <p role="status" className="rs-note" style={{ paddingTop: 12 }}>Checking Google Drive storage…</p>;
  if (statusQuery.isLoading)
    return (
      <div
        role="status"
        aria-label="Loading Google Drive integration"
        className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#101b2b]"
      >
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  if (statusQuery.isError || !statusQuery.data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs font-semibold text-rose-700">
        The Drive integration status could not be loaded.{" "}
        <button
          onClick={() => void statusQuery.refetch()}
          className="ml-1 font-black underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = statusQuery.data;
  const meta = STATUS_META[data.status];
  const StatusIcon = meta.icon;
  const busy =
    connect.isPending ||
    health.isPending ||
    disconnect.isPending ||
    storageRefresh.isPending;

  const storageMetrics = (
    <DriveStorageMetrics
      quota={data.quota}
      connected={data.connected}
      managedBytes={data.managedStorage.bytes}
      fileCount={data.managedStorage.fileCount}
      refreshing={storageRefresh.isPending}
      refresh={() => storageRefresh.mutate()}
      error={storageError}
    />
  );

  if (row) {
    const healthy = data.status === "HEALTHY";
    return (
      <div className="rh-row">
        <span className="rh-icon" data-tone={healthy ? undefined : data.status === "DEGRADED" ? "waiting" : "attention"} aria-hidden="true">
          <i className="ti ti-brand-google-drive" />
        </span>
        <div className="rh-text">
          <h3>Google Drive storage: {meta.label.toLowerCase()}</h3>
          <p data-guide="sa-drive-status">{data.account?.email || "No account"} · checked {dateLabel(data.lastCheckedAt)}</p>
        </div>
        <button type="button" className="rh-secondary" onClick={onManage}>Manage</button>
      </div>
    );
  }

  if (compact) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <HardDrive className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Google Drive Storage
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Institutional document storage
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 dark:bg-white/5 dark:text-slate-200">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
        <div className="mt-5 grid gap-3 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Connected account
            </span>
            <span className="mt-1 block truncate font-bold text-slate-800 dark:text-white">
              {data.account?.email || "No account"}
            </span>
          </div>
        </div>
        {storageMetrics}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/5">
          <span data-guide="sa-drive-status" className="text-xs text-slate-400">
            Connection checked {dateLabel(data.lastCheckedAt)}
          </span>
          <button
            onClick={onManage}
            className="text-sm font-black text-[#0B3A53] hover:underline dark:text-[#C9A227]"
          >
            Manage integration
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="rs">
      <RoleBand
        eyebrow="System administration"
        title="Google Drive"
        titleId="sa-drive-title"
        meta={`Universal document storage managed by Advisio · ${meta.label.toLowerCase()}`}
        counts={[
          { label: "Files", value: data.managedStorage.fileCount.toLocaleString("en-PH") },
          { label: "Status", value: meta.label, tone: data.status === "HEALTHY" ? undefined : "waiting" },
        ]}
        countsLabel="Drive storage summary"
        primary={
          data.connected
            ? { label: "Test connection", icon: "ti-plug-connected", disabled: busy, isLoading: health.isPending, onClick: () => health.mutate() }
            : { label: "Sign in with Google", phoneLabel: "Sign in", icon: "ti-login", disabled: !data.oauthConfigured || busy, isLoading: connect.isPending, onClick: () => connect.mutate() }
        }
        secondary={[
          ...(data.rootFolder?.id
            ? [{ label: "Open folder", icon: "ti-folder-open", onClick: () => window.open(`https://drive.google.com/drive/folders/${data.rootFolder!.id}`, "_blank", "noopener,noreferrer") }]
            : []),
          ...(data.connected
            ? [{
                label: data.status === "ACTION_REQUIRED" ? "Reconnect account" : "Reconnect or change",
                icon: "ti-refresh",
                disabled: busy,
                onClick: () => (data.status === "ACTION_REQUIRED" ? connect.mutate() : setConfirmSwitch(true)),
              }]
            : []),
        ]}
      />
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {!data.encryptionConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-black">
              Production hardening required:
            </strong>{" "}
            add a stable <code>INTEGRATION_ENCRYPTION_KEY</code>. Local
            development currently falls back to the API authentication secret.
          </span>
        </div>
      )}
      <div className="rh-grid rh-grid--even">
        <section className="rh-panel" aria-labelledby="sa-drive-connection">
          <div className="rh-head"><h2 id="sa-drive-connection">Connection</h2></div>
          <div className={`mt-3 rounded-[12px] border p-3.5 ${meta.panel}`}>
            <div className="flex items-start gap-3">
              <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{meta.label}</p>
                <p className="mt-0.5 text-[13px] opacity-80">
                  {data.error?.message ||
                    (data.connected
                      ? "Authentication and storage-folder access are available."
                      : data.oauthConfigured
                        ? "Sign in with an authorized institutional Google account to enable storage."
                        : "Add Google OAuth credentials and an encryption key to the API environment.")}
                </p>
              </div>
            </div>
          </div>
          <dl className="sa-facts">
            <div>
              <dt>Connected account</dt>
              <dd>{data.account?.email || "Not connected"}<small>{data.account?.displayName || "Google Workspace account"}</small></dd>
            </div>
            <div>
              <dt>Root storage folder</dt>
              <dd>{data.rootFolder?.name || "Not created"}<small>{data.rootFolder?.sharedDriveId ? "Shared Drive" : "My Drive / app folder"}</small></dd>
            </div>
            <div>
              <dt>Last health check</dt>
              <dd>{dateLabel(data.lastCheckedAt)}<small>{data.lastHealthyAt ? `Last healthy: ${dateLabel(data.lastHealthyAt)}` : "No successful check recorded"}</small></dd>
            </div>
          </dl>
          <div className="sa-danger">
            <div>
              <h3>Disconnect storage</h3>
              <p>Only System Administrators can change the institution-level storage connection.</p>
            </div>
            <button type="button" disabled={!data.connected || busy} onClick={() => setConfirmDisconnect(true)}>
              <i className="ti ti-unlink" aria-hidden="true" /> Disconnect
            </button>
          </div>
        </section>
        <section className="rh-panel" style={{ height: "fit-content" }} aria-label="Storage">
          {storageMetrics}
        </section>
      </div>

      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-drive-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101b2b]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h3
              id="disconnect-drive-title"
              className="mt-4 text-lg font-black text-slate-900 dark:text-white"
            >
              Disconnect Google Drive?
            </h3>
            <p className="mt-2 text-base leading-5 text-slate-500 dark:text-slate-400">
              New uploads will stop until an administrator reconnects storage.
              Existing Google Drive files will not be deleted.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 dark:border-white/10 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                {disconnect.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Disconnect storage
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmSwitch && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-drive-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101b2b]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h3
              id="switch-drive-title"
              className="mt-4 text-lg font-black text-slate-900 dark:text-white"
            >
              Reconnect or change account?
            </h3>
            <p className="mt-2 text-base leading-5 text-slate-500 dark:text-slate-400">
              Choose the same account to refresh access. Choosing a different
              account moves new uploads to that account; existing files remain
              in the current Google Drive and are not migrated automatically.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSwitch(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 dark:border-white/10 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={connect.isPending}
                onClick={() => {
                  setConfirmSwitch(false);
                  connect.mutate();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 dark:bg-[#C9A227] dark:text-[#0B3A53]"
              >
                <LogIn className="h-4 w-4" />
                Continue to Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

