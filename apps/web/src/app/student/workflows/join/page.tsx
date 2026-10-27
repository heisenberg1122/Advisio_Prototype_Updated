import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { refreshResearcherContext } from "@/lib/researcher-lifecycle-actions";
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
      await refreshResearcherContext(client);
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
          <p role="status">Checking research process access link...</p>
        ) : query.isError || !invitation ? (
          <>
            <h1 className="text-xl font-bold">
              Research process access link unavailable
            </h1>
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
              Request access to {invitation.name}
            </h1>
            <p>
              Research coordinator: {invitation.professor.firstName}{" "}
              {invitation.professor.lastName}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Approved process access remains subject to your research study's
              membership and requirements. Prepare your cohort and team from the
              dashboard.
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
                Your request for access to {invitation.name} has been sent.
                Please wait for your research coordinator to approve it.
              </p>
            ) : invitation.requestStatus === "DECLINED" ? (
              <p>
                Your request was declined. Contact your research coordinator for
                an invitation.
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
                  {busy ? "Sending request..." : "Request access"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
