import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";

export interface AdviserRequestHistoryItem {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | string;
  createdAt: string | Date;
  respondedAt?: string | Date | null;
  responseNote?: string | null;
  adviser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  requestedBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

interface AdviserRequestHistoryProps {
  history: AdviserRequestHistoryItem[];
  onViewProfile?: (adviser: any) => void;
}

export function AdviserRequestHistory({
  history,
  onViewProfile,
}: AdviserRequestHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Request History
        </h4>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          No previous adviser requests recorded for this milestone.
        </p>
      </section>
    );
  }

  const formatDateTime = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getOutcomeTag = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return <Tag variant="success">Accepted</Tag>;
      case "REJECTED":
        return <Tag variant="warn">Declined</Tag>;
      case "CANCELLED":
        return <Tag variant="neutral">Withdrawn</Tag>;
      case "PENDING":
      default:
        return <Tag variant="info">Pending</Tag>;
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Request History
          </h4>
          <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--color-text-secondary)]">
            {history.length} {history.length === 1 ? "record" : "records"}
          </span>
        </div>
      </div>

      <div className="space-y-3.5">
        {history.map((item) => {
          const adviserName =
            `${item.adviser?.firstName || ""} ${item.adviser?.lastName || ""}`.trim() ||
            item.adviser?.email ||
            "Faculty Adviser";
          const leaderName =
            `${item.requestedBy?.firstName || ""} ${item.requestedBy?.lastName || ""}`.trim() ||
            item.requestedBy?.email ||
            "Group Leader";
          const initials =
            `${item.adviser?.firstName?.[0] || "A"}${item.adviser?.lastName?.[0] || ""}`.toUpperCase();

          return (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4 transition hover:border-[var(--color-primary)]/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar initials={initials} size="sm" colorVariant="info" />
                  <div>
                    <h5 className="font-bold text-sm text-[var(--color-text-primary)] leading-tight">
                      {adviserName}
                    </h5>
                    {item.adviser?.email && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {item.adviser.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start">
                  {onViewProfile && item.adviser && (
                    <button
                      type="button"
                      onClick={() =>
                        onViewProfile({
                          ...item.adviser,
                          name: adviserName,
                          initials,
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                    >
                      <i className="ti ti-id" aria-hidden="true" />
                      View Profile
                    </button>
                  )}
                  {getOutcomeTag(item.status)}
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs border-t border-[var(--color-border)]/60 pt-3 text-[var(--color-text-secondary)]">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Requested by:
                  </span>{" "}
                  <span>{leaderName}</span>
                </div>
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Submitted:
                  </span>{" "}
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {item.status === "ACCEPTED"
                      ? "Accepted on:"
                      : item.status === "REJECTED"
                        ? "Declined on:"
                        : item.status === "CANCELLED"
                          ? "Withdrawn on:"
                          : "Decision:"}
                  </span>{" "}
                  <span>
                    {item.respondedAt
                      ? formatDateTime(item.respondedAt)
                      : "Awaiting response"}
                  </span>
                </div>
              </div>

              {item.responseNote && (
                <div
                  className={`mt-3 rounded-lg p-2.5 text-xs ${
                    item.status === "REJECTED"
                      ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                      : item.status === "CANCELLED"
                        ? "border border-slate-200 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  }`}
                >
                  <strong className="block font-semibold mb-0.5">
                    {item.status === "REJECTED"
                      ? "Decline reason:"
                      : item.status === "CANCELLED"
                        ? "Withdrawal remarks:"
                        : "Adviser remarks:"}
                  </strong>
                  <p className="whitespace-pre-wrap">{item.responseNote}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
