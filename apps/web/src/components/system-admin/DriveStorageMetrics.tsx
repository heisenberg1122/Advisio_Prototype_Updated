import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  STORAGE_FRESH_MS,
  storageBytes,
  storageValues,
  type StorageQuota,
} from "./drive-storage-metrics";

export function DriveStorageMetrics({
  quota,
  connected,
  managedBytes,
  fileCount,
  refreshing,
  refresh,
  error,
}: {
  quota?: StorageQuota | null;
  connected: boolean;
  managedBytes: number;
  fileCount: number;
  refreshing: boolean;
  refresh: () => void;
  error: string | null;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const { used, limit, remaining, percent } = storageValues(
    connected ? quota : null,
  );
  const checked =
    connected && quota?.checkedAt ? new Date(quota.checkedAt) : null;
  const outdated = Boolean(
    checked &&
    (error || quota?.error || now - checked.getTime() >= STORAGE_FRESH_MS),
  );
  const throttled = Boolean(
    quota?.attemptedAt && now - new Date(quota.attemptedAt).getTime() < 60_000,
  );
  const box = "rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]";
  return (
    <div className="mt-4 space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className={`${box} sm:col-span-2`}>
          <dt className="text-sm text-slate-500 dark:text-slate-400">
            Google storage · total used / capacity
          </dt>
          <dd className="mt-1 font-bold text-slate-800 dark:text-white">
            {storageBytes(used)} /{" "}
            {limit === null ? "Capacity not reported" : storageBytes(limit)}
          </dd>
          {percent !== null && (
            <div className="mt-2">
              <div
                role="progressbar"
                aria-label="Google storage used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(percent, 100)}
                aria-valuetext={`${percent.toLocaleString("en-PH")} percent used`}
                className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-[#C9A227]"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {percent.toLocaleString("en-PH")}% used
              </p>
            </div>
          )}
        </div>
        <div className={box}>
          <dt className="text-sm text-slate-500 dark:text-slate-400">
            Remaining storage
          </dt>
          <dd className="mt-1 font-bold text-slate-800 dark:text-white">
            {storageBytes(remaining)}
          </dd>
        </div>
        <div className={box}>
          <dt className="text-sm text-slate-500 dark:text-slate-400">
            Advisio-managed usage
          </dt>
          <dd className="mt-1 font-bold text-slate-800 dark:text-white">
            {storageBytes(BigInt(Math.max(0, Math.trunc(managedBytes))))}
          </dd>
          <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {fileCount.toLocaleString("en-PH")} recorded files · recorded
            document sizes
          </dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Google totals can include Drive, Gmail, and Photos. Workspace capacity
        and total usage may cover the organization’s pooled storage, including
        shared drives. Advisio-managed usage reflects document records and may
        differ from live Drive usage.
      </p>
      {(!connected || error || quota?.error) && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          {!connected
            ? "Connect Google Drive to retrieve storage capacity."
            : error || quota?.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Storage last checked:{" "}
          {checked
            ? `${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(checked)} PHT`
            : "Not checked yet"}
          {outdated && (
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              · Outdated
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={!connected || refreshing || throttled}
          title={
            throttled ? "Storage can be refreshed once per minute" : undefined
          }
          className="inline-flex items-center gap-2 text-sm font-bold text-[#0B3A53] disabled:opacity-50 dark:text-[#C9A227]"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh storage"}
        </button>
      </div>
    </div>
  );
}
