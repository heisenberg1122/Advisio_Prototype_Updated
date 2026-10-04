"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
  quota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  } | null;
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

function bytesLabel(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

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
  onManage,
}: {
  compact?: boolean;
  onManage?: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const statusQuery = useQuery({
    queryKey: ["google-drive-integration"],
    queryFn: () =>
      apiClient.get<DriveStatus>("/api/integrations/google-drive/status"),
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

  if (statusQuery.isLoading)
    return (
      <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b2b]" />
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
  const busy = connect.isPending || health.isPending || disconnect.isPending;

  if (compact) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <HardDrive className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Google Drive Storage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional document storage
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700 dark:bg-white/5 dark:text-slate-200">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Connected account
            </span>
            <span className="mt-1 block truncate font-bold text-slate-800 dark:text-white">
              {data.account?.email || "No account"}
            </span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Managed storage
            </span>
            <span className="mt-1 block font-bold text-slate-800 dark:text-white">
              {bytesLabel(data.managedStorage.bytes)} ·{" "}
              {data.managedStorage.fileCount} files
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/5">
          <span className="text-[11px] text-slate-400">
            Checked {dateLabel(data.lastCheckedAt)}
          </span>
          <button
            onClick={onManage}
            className="text-xs font-black text-[#0B3A53] hover:underline dark:text-[#C9A227]"
          >
            Manage integration
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
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
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Cloud className="h-7 w-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Google Drive
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-700 dark:bg-white/5 dark:text-slate-200">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Universal document storage managed by Advisio.
              </p>
            </div>
          </div>
          {!data.connected ? (
            <button
              disabled={!data.oauthConfigured || busy}
              onClick={() => connect.mutate()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0B3A53] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#C9A227] dark:text-[#0B3A53]"
            >
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign in with Google
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                data.status === "ACTION_REQUIRED"
                  ? connect.mutate()
                  : setConfirmSwitch(true)
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" />
              {data.status === "ACTION_REQUIRED"
                ? "Reconnect account"
                : "Reconnect or change account"}
            </button>
          )}
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${meta.panel}`}>
              <div className="flex items-start gap-3">
                <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">{meta.label}</p>
                  <p className="mt-1 text-xs opacity-80">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                icon={UserRound}
                label="Connected account"
                value={data.account?.email || "Not connected"}
                secondary={
                  data.account?.displayName || "Google Workspace account"
                }
              />
              <Info
                icon={FolderOpen}
                label="Root storage folder"
                value={data.rootFolder?.name || "Not created"}
                secondary={
                  data.rootFolder?.sharedDriveId
                    ? "Shared Drive"
                    : "My Drive / app folder"
                }
              />
              <Info
                icon={HardDrive}
                label="Advisio-managed usage"
                value={bytesLabel(data.managedStorage.bytes)}
                secondary={`${data.managedStorage.fileCount} stored file${data.managedStorage.fileCount === 1 ? "" : "s"}`}
              />
              <Info
                icon={RefreshCw}
                label="Last health check"
                value={dateLabel(data.lastCheckedAt)}
                secondary={
                  data.lastHealthyAt
                    ? `Last healthy: ${dateLabel(data.lastHealthyAt)}`
                    : "No successful check recorded"
                }
              />
            </div>
          </div>
          <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.02]">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Connection controls
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Only System Administrators can change the institution-level
              storage connection.
            </p>
            <div className="mt-5 space-y-2">
              <button
                disabled={!data.connected || busy}
                onClick={() => health.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2.5 text-xs font-black text-[#0B3A53] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {health.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Test connection
              </button>
              {data.rootFolder?.id && (
                <a
                  href={`https://drive.google.com/drive/folders/${data.rootFolder.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open storage folder
                </a>
              )}
              <button
                disabled={!data.connected || busy}
                onClick={() => setConfirmDisconnect(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-500/10"
              >
                <Unplug className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </aside>
        </div>
      </section>

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
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              New uploads will stop until an administrator reconnects storage.
              Existing Google Drive files will not be deleted.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 dark:border-white/10 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
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
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Choose the same account to refresh access. Choosing a different
              account moves new uploads to that account; existing files remain
              in the current Google Drive and are not migrated automatically.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSwitch(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 dark:border-white/10 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={connect.isPending}
                onClick={() => {
                  setConfirmSwitch(false);
                  connect.mutate();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 dark:bg-[#C9A227] dark:text-[#0B3A53]"
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

function Info({
  icon: Icon,
  label,
  value,
  secondary,
}: {
  icon: typeof Cloud;
  label: string;
  value: string;
  secondary: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 dark:border-white/5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-[#0B3A53] dark:bg-white/5 dark:text-[#C9A227]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="mt-1 block truncate text-xs font-black text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="mt-0.5 block text-[10px] text-slate-400">
          {secondary}
        </span>
      </span>
    </div>
  );
}
