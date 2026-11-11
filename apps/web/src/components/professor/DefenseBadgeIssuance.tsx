import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  DefenseBadgeCard,
  type DefenseBadge,
} from "@/components/defense/DefenseBadgeCard";
import { DefenseCertificateIssuance } from "./DefenseCertificateIssuance";

type Session = {
  id: string;
  status: string;
  decision: string | null;
  releasedAt: string | null;
  revisionClearance?: unknown;
  defenseEvent?: { defenseType: string } | null;
  research: { title: string };
  badge?: DefenseBadge | null;
};

export function DefenseBadgeIssuance({
  sessions,
  canIssue,
  onIssued,
}: {
  sessions: Session[];
  canIssue: boolean;
  onIssued: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<Record<string, DefenseBadge>>({});
  const eligible = sessions.filter(
    (session) =>
      session.badge ||
      (session.status === "COMPLETED" &&
        (session.decision === "APPROVED" ||
          (Boolean(session.revisionClearance) &&
            [
              "APPROVED_WITH_MINOR_REVISIONS",
              "MAJOR_REVISIONS_REQUIRED",
            ].includes(session.decision || ""))) &&
        session.releasedAt &&
        ["TITLE_DEFENSE", "FINAL_DEFENSE", "FINAL_ORAL_DEFENSE"].includes(
          session.defenseEvent?.defenseType || "",
        )),
  );

  const issue = async (sessionId: string) => {
    setPending(sessionId);
    setError("");
    try {
      const result = await apiClient.post<{ badge: DefenseBadge }>(
        `/api/defense-sessions/${sessionId}/badge`,
        {},
      );
      setIssued((current) => ({ ...current, [sessionId]: result.badge }));
      await onIssued();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The badge could not be issued. Please try again.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
        Defense badges
      </h2>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}
      {!eligible.length && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          No groups are eligible for a badge yet.
        </p>
      )}
      <details className="cdf-help mt-3">
        <summary>How it works</summary>
        <p>
          Award badges after releasing an approved title or final defense result.
          If revisions were required, clear them before issuing the badge.
        </p>
      </details>
      <div className="mt-4 space-y-4">
        {eligible.map((session) => {
          const badge = session.badge || issued[session.id];
          return (
            <div key={session.id}>
              <p className="mb-2 font-semibold text-[var(--color-text-primary)]">
                {session.research.title}
              </p>
              {badge ? (
                <DefenseBadgeCard
                  badge={badge}
                  action={canIssue && badge.kind === "FINAL_DEFENSE" && !badge._count?.certificates
                    ? <DefenseCertificateIssuance sessionId={session.id} onIssued={onIssued} />
                    : undefined}
                />
              ) : canIssue ? (
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => issue(session.id)}
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <i className="ti ti-award mr-1.5" aria-hidden="true" />
                  {pending === session.id
                    ? "Issuing badge…"
                    : `Issue ${session.defenseEvent?.defenseType === "TITLE_DEFENSE" ? "title" : "final"} defense badge`}
                </button>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Awaiting coordinator issuance.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
