import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
export default function JoinWorkflowPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["workflow-invitation", code],
    queryFn: () =>
      apiClient.get<{ invitation: any }>(
        `/api/workflows/invitation/${encodeURIComponent(code)}`,
      ),
    retry: false,
  });
  const invitation = query.data?.invitation;
  async function request() {
    setBusy(true);
    setError("");
    try {
      const result = await apiClient.post<{ alreadyJoined?: boolean }>(
        `/api/workflows/join/${encodeURIComponent(code)}`,
        {},
      );
      await client.invalidateQueries({ queryKey: ["workflow-access-me"] });
      navigate(result.alreadyJoined ? "/student/tasks" : "/student/dashboard", {
        replace: true,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto w-full max-w-2xl p-5">
      <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        {query.isPending ? (
          <p role="status">Checking workflow link...</p>
        ) : query.isError || !invitation ? (
          <>
            <h1 className="text-xl font-bold">Workflow link unavailable</h1>
            <p>
              {(query.error as Error)?.message ||
                "This link is invalid, expired, or unavailable to your account."}
            </p>
            <button onClick={() => navigate("/student/tasks")}>
              Go to Tasks & Requirements
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">
              Request to join {invitation.name}
            </h1>
            <p>
              Professor: {invitation.professor.firstName}{" "}
              {invitation.professor.lastName}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Milestones, tasks, resources, and participants become available
              after your request is approved.
            </p>
            {error && (
              <p role="alert" className="text-rose-600">
                {error}
              </p>
            )}
            {invitation.alreadyJoined ? (
              <button
                onClick={() => navigate("/student/tasks")}
                className="rounded-lg bg-[#173f63] px-4 py-2 font-bold text-white"
              >
                View Tasks & Requirements
              </button>
            ) : invitation.requestStatus === "PENDING" ? (
              <p role="status">
                Your request to join {invitation.name} has been sent. Please
                wait for the professor to approve it.
              </p>
            ) : invitation.requestStatus === "DECLINED" ? (
              <p>
                Your request was declined. Contact the professor for an
                invitation.
              </p>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/student/tasks")}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  onClick={() => void request()}
                  className="rounded-lg bg-[#173f63] px-4 py-2 font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Sending request..." : "Request to join"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
