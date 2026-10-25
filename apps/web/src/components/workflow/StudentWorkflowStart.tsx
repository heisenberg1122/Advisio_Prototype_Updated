import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function StudentWorkflowStart({
  enrollments,
  workspaces,
  loading = false,
}: {
  enrollments: any[];
  workspaces: any[];
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState("");
  const [pendingWorkflow, setPendingWorkflow] = useState<string | null>(null);
  const [error, setError] = useState("");
  const start = async (workflowId: string) => {
    setPendingWorkflow(workflowId);
    setError("");
    try {
      const result = await apiClient.post<{ projectId: string }>(
        `/api/workflows/${workflowId}/start-project`,
        workspaceId !== "SOLO"
          ? { workspaceId }
          : { participationMode: "SOLO" },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student-research"] }),
        queryClient.invalidateQueries({
          queryKey: ["student", "workflow-tasks"],
        }),
        queryClient.invalidateQueries({ queryKey: ["student-workspaces"] }),
      ]);
      navigate(
        `/student/tasks?projectId=${encodeURIComponent(result.projectId)}`,
      );
    } catch (failure: any) {
      setError(failure.message || "Unable to start this workflow.");
    } finally {
      setPendingWorkflow(null);
    }
  };
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
        Start your professor's workflow
      </h2>
      <p className="mt-2 text-base text-[var(--color-text-secondary)]">
        Choose your workspace and begin the available milestones. Your research
        title will be collected when a milestone requires it.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">
          Loading joined workflows and workspaces…
        </p>
      ) : (
        <>
          <label className="mt-4 block text-sm font-semibold text-[var(--color-text-primary)]">
            Submission workspace
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              disabled={Boolean(pendingWorkflow)}
              className="mt-2 block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3"
            >
              <option value="" disabled>
                Choose Solo research or your group workspace
              </option>
              <option value="SOLO">Solo research — only me</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ·{" "}
                  {workspace.participationMode === "GROUP"
                    ? "Shared group"
                    : "Solo workspace"}
                </option>
              ))}
            </select>
          </label>
          {workspaceId === "SOLO" &&
            workspaces.some(
              (workspace) => workspace.participationMode === "GROUP",
            ) && (
              <p className="mt-2 text-sm text-amber-800">
                Choose your group above if you are submitting together. Solo
                research creates an individual record.
              </p>
            )}
          <div className="mt-4 space-y-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.workflowId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4"
              >
                <div>
                  <p className="font-bold text-[var(--color-text-primary)]">
                    {enrollment.workflow?.name || "Research workflow"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Research title pending ·{" "}
                    {enrollment.workflow?.stages?.length || 0} milestones
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => start(enrollment.workflowId)}
                  disabled={Boolean(pendingWorkflow) || !workspaceId}
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pendingWorkflow === enrollment.workflowId
                    ? "Starting…"
                    : "Start / Continue workflow"}
                </button>
              </div>
            ))}
          </div>
          {!enrollments.length && (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              No workflow joined yet. Accept your professor's invitation in{" "}
              <Link to="/student/tasks" className="font-semibold underline">
                Tasks & Requirements
              </Link>
              .
            </p>
          )}
          <Link
            to="/student/dashboard?tab=group&section=my-group"
            className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary)] underline"
          >
            Manage or join a group
          </Link>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
    </section>
  );
}
