import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";

type Props = {
  workflowId: string;
  locked?: boolean;
  message?: string;
  label?: string;
};
export function WorkflowStartPanel({
  workflowId,
  locked,
  message,
  label = "Start this milestone",
}: Props) {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const workspaces = useQuery({
    queryKey: ["student-workspaces"],
    queryFn: () => apiClient.get<{ workspaces: any[] }>("/api/workspaces/me"),
  });
  useEffect(() => {
    if (workspaces.data && !workspaceId) {
      const list = workspaces.data.workspaces;
      if (list.length <= 1) setWorkspaceId(list[0]?.id || "solo");
    }
  }, [workspaces.data, workspaceId]);
  const start = async () => {
    if (busy || locked || !workspaceId) return;
    setBusy(true);
    setError("");
    try {
      const { project } = await apiClient.post<{ project: { id: string } }>(
        `/api/workflows/${workflowId}/participation`,
        { workspaceId: workspaceId === "solo" ? null : workspaceId },
      );
      await client.invalidateQueries();
      const params = new URLSearchParams(location.search);
      params.set("projectId", project.id);
      params.set("workflowId", workflowId);
      params.delete("researchId");
      navigate(`${location.pathname}?${params}`, { replace: true });
    } catch (e: any) {
      setError(e.message || "Unable to start this workflow.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
        Start from your workflow
      </h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        A registered research title is not required. Your work and adviser
        requests will be kept as you follow your professor’s milestones.
      </p>
      {locked ? (
        <p className="mt-3 text-sm font-semibold text-amber-700">
          {message || "Complete the preceding milestones first."}
        </p>
      ) : (
        <>
          {workspaces.isPending && (
            <p className="mt-3 text-sm">Loading your workspaces…</p>
          )}
          {workspaces.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              Unable to load workspaces.{" "}
              <button
                type="button"
                onClick={() => workspaces.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          )}
          {workspaces.data && (
            <label className="mt-4 block text-sm font-semibold text-[var(--color-text-primary)]">
              Work with
              <select
                disabled={busy}
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <option value="" disabled>
                  Choose a workspace
                </option>
                <option value="solo">Work individually</option>
                {workspaces.data.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={start}
            disabled={
              busy || !workspaceId || workspaces.isPending || workspaces.isError
            }
            className="mt-4 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Starting…" : label}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
