import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { OFFLINE_READ } from "@/lib/offline/cache";
import { readOffline } from "@/lib/offline/store";
import { useOfflineReadOnly, useOfflineSession } from "./use-offline";

export function OfflineStatus() {
  const readOnly = useOfflineReadOnly();
  const { session } = useOfflineSession();
  const { pathname, search } = useLocation();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSavedAt(null);
    if (session)
      void readOffline(session, "response:/api/research")
        .then((record) => {
          if (!cancelled && record)
            setSavedAt((previous) =>
              previous ? Math.min(previous, record.savedAt) : record.savedAt,
            );
        })
        .catch(() => {});
    const saved = (event: Event) => {
      const time = (event as CustomEvent<{ savedAt: number }>).detail.savedAt;
      setSavedAt((previous) => (previous ? Math.min(previous, time) : time));
    };
    window.addEventListener(OFFLINE_READ, saved);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_READ, saved);
    };
  }, [session, pathname, search]);
  if (!readOnly) return null;
  return (
    <p
      role="status"
      className="mb-3 border-b border-[var(--color-border)] pb-3 text-sm text-[var(--color-text-secondary)]"
    >
      <strong>Offline</strong>
      {savedAt
        ? ` · Showing information saved ${new Date(savedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} (Manila time)`
        : " · Only information saved on this device is available"}
      . Drafts stay here until you review and submit online.
    </p>
  );
}
