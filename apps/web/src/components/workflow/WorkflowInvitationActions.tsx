import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
export type WorkflowInboxInvitation = {
  id: string;
  userId: string;
  status: string;
  workflow: { name: string };
};
export function WorkflowInvitationActions({
  invitation,
  userId,
}: {
  invitation: WorkflowInboxInvitation;
  userId?: string;
}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function respond(action: string) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/api/workflows/access/${invitation.id}/decision`, {
        action,
      });
      await client.invalidateQueries({
        predicate: (q) =>
          /workflow|enrollment|mail|student/.test(JSON.stringify(q.queryKey)),
      });
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border-[3px] border-[var(--color-primary)] bg-[var(--color-surface)] p-5 text-sm shadow-[var(--shadow-card-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Workflow invitation</p>
          <strong className="block break-words text-base text-[var(--color-text-primary)]">{invitation.workflow.name}</strong>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${invitation.status === "ACCEPTED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]"}`}>{invitation.status.toLowerCase().replace(/_/g, " ")}</span>
      </div>
      {error && (
        <p role="alert" className="text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
      {invitation.userId === userId && invitation.status === "PENDING" ? (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => void respond("accept")}
            className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 py-2 font-bold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] disabled:opacity-50"
          >
            Accept invitation
          </button>
          <button
            disabled={busy}
            onClick={() => void respond("decline")}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-bold text-[var(--color-text-primary)] disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : invitation.userId === userId && invitation.status === "ACCEPTED" ? (
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-subtle)]"
          to="/student/tasks"
        >
          View workflow tasks and requirements
        </Link>
      ) : null}
    </section>
  );
}
