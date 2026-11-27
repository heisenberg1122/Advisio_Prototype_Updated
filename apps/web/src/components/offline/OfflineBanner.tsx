import { Link } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { useConnectivity } from "./use-offline";

export function OfflineBanner() {
  const online = useConnectivity();
  const { isOfflineSession } = useAuth();
  return (
    <aside
      role="status"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${!online || isOfflineSession ? "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}
    >
      <span>
        {!online || isOfflineSession
          ? "You’re offline. Open your saved requirements, files, and drafts."
          : "Keep requirements and selected files available when your connection drops."}
      </span>
      <Link
        className="font-bold underline underline-offset-4"
        to="/student/offline"
      >
        Offline workspace
      </Link>
    </aside>
  );
}
