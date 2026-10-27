import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
export function WorkflowAccessInbox() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["workflow-access-me"],
    queryFn: () =>
      apiClient.get<{ entries: any[] }>("/api/workflows/access/me"),
    refetchInterval: 15000,
  });
  async function cancel(id: string) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/api/workflows/access/${id}/decision`, {
        action: "cancel",
      });
      await client.invalidateQueries({ queryKey: ["workflow-access-me"] });
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return null;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-rose-600">
        Research process access status could not be loaded.
      </p>
    );
  const entries =
    query.data?.entries.filter(
      (e) =>
        e.status === "PENDING" ||
        (e.kind === "REQUEST" && e.status === "DECLINED"),
    ) || [];
  if (!entries.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="font-bold">Research process access requests and invitations</h2>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {entries.map((e) => (
        <article
          key={e.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm"
        >
          <div>
            <strong>{e.workflow.name}</strong>
            <p>
              {e.kind === "INVITATION"
                ? "You have been invited. Open your Advisio inbox to accept or decline."
                : e.status === "PENDING"
                  ? `Your access request for ${e.workflow.name} has been sent. Please wait for your research coordinator to approve it.`
                  : "Your access request was declined. Contact your research coordinator for an invitation."}
            </p>
          </div>
          {e.kind === "INVITATION" ? (
            <Link
              className="font-bold text-[var(--color-primary)]"
              to={`/student/inbox?thread=${e.mailThreadId}`}
            >
              Open invitation
            </Link>
          ) : (
            e.status === "PENDING" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancel(e.id)}
                className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50"
              >
                Cancel request
              </button>
            )
          )}
        </article>
      ))}
    </section>
  );
}
