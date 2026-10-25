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
    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
      <strong>{invitation.workflow.name}</strong>
      <p>Workflow invitation: {invitation.status.toLowerCase()}</p>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {invitation.userId === userId && invitation.status === "PENDING" ? (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => void respond("accept")}
            className="rounded-lg bg-[#173f63] px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            Accept invitation
          </button>
          <button
            disabled={busy}
            onClick={() => void respond("decline")}
            className="rounded-lg border px-4 py-2 font-bold disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : invitation.userId === userId && invitation.status === "ACCEPTED" ? (
        <Link
          className="font-bold text-[var(--color-primary)]"
          to="/student/tasks"
        >
          View workflow tasks and requirements
        </Link>
      ) : null}
    </section>
  );
}
