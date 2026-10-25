import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";

export function WorkflowAvailabilitySettings({
  workflow,
  onChanged,
}: {
  workflow: { id: string; availabilityMode?: string };
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<Array<{
    researchId: string;
    name: string;
  }> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const explicit = workflow.availabilityMode === "PREREQUISITES";
  const inspect = async () => {
    setPending(true);
    setError("");
    try {
      const result = await apiClient.get<{
        groups: Array<{ researchId: string; name: string }>;
      }>(`/api/workflows/${workflow.id}/availability-preview`);
      setPreview(result.groups);
    } catch (failure: any) {
      setError(failure.message || "Unable to preview affected groups.");
    } finally {
      setPending(false);
    }
  };
  const save = async () => {
    setPending(true);
    setError("");
    try {
      await apiClient.post(`/api/workflows/${workflow.id}/availability`, {
        availabilityMode: "PREREQUISITES",
      });
      setPreview(null);
      onChanged();
    } catch (failure: any) {
      setError(failure.message || "Unable to update availability.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-[#102f49]">Milestone availability</h3>
      <p className="mt-1 text-sm text-slate-600">
        {explicit
          ? "Prerequisite-based: Independent milestones can start without earlier milestones. Other milestones require all selected prerequisites to pass."
          : "This workflow uses milestone order. Switch to prerequisites to configure Independent milestones and dependencies across topics."}
      </p>
      {!explicit && (
        <button
          type="button"
          disabled={pending}
          onClick={inspect}
          className="mt-3 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Review switch to prerequisites
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <Modal
        isOpen={preview !== null}
        onClose={() => {
          if (!pending) setPreview(null);
        }}
        title="Use prerequisite-based availability"
        subtitle="This changes availability for every group in this workflow."
      >
        <p className="text-sm text-slate-600">
          Milestones without prerequisites become Independent. Saved
          prerequisites take effect immediately. Earlier submission and approval
          history stays available.
        </p>
        <p className="mt-3 font-bold">
          Affected groups: {preview?.length || 0}
        </p>
        <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 text-sm">
          {preview?.map((group) => (
            <li key={group.researchId}>{group.name}</li>
          ))}
        </ul>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="mt-5 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Enable prerequisites"}
        </button>
      </Modal>
    </section>
  );
}

const revisionCandidates = (stage: any): any[] =>
  stage.requiresDocument
    ? stage.tasks.filter(
        (task: any) => task.isRequired || task.status === "APPROVED",
      )
    : [];

export function GroupMilestoneReview({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["group-milestone-review", projectId],
    queryFn: () =>
      apiClient.get<{ milestones: any[]; decisions?: any[] }>(
        `/api/research/${projectId}/manuscript-workflow`,
      ),
    refetchOnWindowFocus: true,
  });
  const [selection, setSelection] = useState<{
    milestone: any;
    action: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const milestones = query.data?.milestones || [];
  const affected = new Set(selection ? [selection.milestone.id] : []);
  for (let index = 0; index < milestones.length; index++)
    for (const stage of milestones)
      if ((stage.prerequisiteIds || []).some((id: string) => affected.has(id)))
        affected.add(stage.id);
  const open = (milestone: any, action: string) => {
    setSelection({ milestone, action });
    setTaskIds(revisionCandidates(milestone).map((task: any) => task.id));
    setReason("");
    setError("");
  };
  const save = async () => {
    if (!selection) return;
    setPending(true);
    setError("");
    try {
      await apiClient.post(
        `/api/workflows/projects/${projectId}/milestones/${selection.milestone.id}/decision`,
        {
          action: selection.action,
          reason,
          ...(selection.action === "REQUEST_REVISION" ? { taskIds } : {}),
        },
      );
      setSelection(null);
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["professor-milestone-progress"],
        }),
        queryClient.invalidateQueries({ queryKey: ["professor-research"] }),
      ]);
      onChanged();
    } catch (failure: any) {
      setError(failure.message || "Unable to save the milestone decision.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="mt-6 space-y-3">
      <h3 className="font-extrabold text-[#102f49]">
        Group milestone decisions
      </h3>
      {query.isPending && (
        <p className="text-sm text-slate-500">Loading milestone decisions…</p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-700">
          Unable to load milestones.{" "}
          <button onClick={() => query.refetch()} className="underline">
            Retry
          </button>
        </p>
      )}
      {milestones.map((stage) => (
        <div key={stage.id} className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{stage.topic?.title}</p>
          <h4 className="font-bold text-[#102f49]">{stage.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {stage.status.replace(/_/g, " ")}
            {stage.locked ? " · Blocked" : ""}
          </p>
          {stage.blockedReason && (
            <p className="mt-1 text-sm text-amber-800">{stage.blockedReason}</p>
          )}
          {stage.reason && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
              {stage.reason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(stage.completed ||
              stage.ownRequirementsSatisfied ||
              stage.needsRevalidation) &&
              stage.status !== "REVISION_REQUIRED" && (
                <button
                  onClick={() => open(stage, "REQUEST_REVISION")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900"
                >
                  Request revision
                </button>
              )}
            {stage.needsRevalidation && !stage.locked && (
              <button
                onClick={() => open(stage, "RECONFIRM")}
                className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-bold text-white"
              >
                Reconfirm approval
              </button>
            )}
            {!stage.requiresDocument &&
              !stage.completed &&
              !stage.needsRevalidation &&
              !stage.locked && (
                <button
                  onClick={() => open(stage, "APPROVE")}
                  className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-bold text-white"
                >
                  Mark as passed
                </button>
              )}
          </div>
        </div>
      ))}
      {!!query.data?.decisions?.length && (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-bold">
            Milestone decision history
          </summary>
          <ol className="mt-3 space-y-3">
            {query.data.decisions.map((event) => (
              <li
                key={event.id}
                className="border-t border-slate-100 pt-2 text-sm"
              >
                <strong>
                  {event.stage?.name}: {event.decision.replace(/_/g, " ")}
                </strong>
                <p>{event.reason}</p>
                <p className="text-xs text-slate-500">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
      <Modal
        isOpen={Boolean(selection)}
        onClose={() => {
          if (!pending) setSelection(null);
        }}
        title={
          selection?.action === "REQUEST_REVISION"
            ? "Request milestone revision"
            : "Confirm milestone approval"
        }
        subtitle={selection?.milestone.name}
      >
        {selection?.action === "REQUEST_REVISION" && (
          <>
            <p className="text-sm text-slate-600">
              This group must revise the selected requirements. Earlier
              approvals and submitted files remain in history.
            </p>
            {revisionCandidates(selection.milestone).map((task: any) => (
              <label
                key={task.id}
                className="mt-3 flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={taskIds.includes(task.id)}
                  onChange={(event) =>
                    setTaskIds(
                      event.target.checked
                        ? [...taskIds, task.id]
                        : taskIds.filter((id) => id !== task.id),
                    )
                  }
                />
                {task.title}
              </label>
            ))}
            <p className="mt-4 text-sm font-bold">
              Dependent milestones that will be blocked:
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {milestones
                .filter(
                  (stage) =>
                    stage.id !== selection.milestone.id &&
                    affected.has(stage.id),
                )
                .map((stage) => (
                  <li key={stage.id}>
                    {stage.topic?.title} → {stage.name}
                  </li>
                ))}
            </ul>
            {affected.size === 1 && (
              <p className="mt-1 text-sm text-slate-500">
                No dependent milestones.
              </p>
            )}
          </>
        )}
        <label className="mt-4 block text-sm font-bold">
          Reason / feedback
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={4000}
            rows={4}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={
            pending ||
            reason.trim().length < 3 ||
            (selection?.action === "REQUEST_REVISION" &&
              revisionCandidates(selection.milestone).length > 0 &&
              !taskIds.length)
          }
          className="mt-4 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save decision"}
        </button>
      </Modal>
    </section>
  );
}
