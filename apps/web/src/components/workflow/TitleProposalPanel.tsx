import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";

type Props = {
  stageId: string;
  count: number;
  researchId?: string;
  workflowId?: string;
  canSubmit?: boolean;
  locked?: boolean;
  review?: boolean;
};
export function TitleProposalPanel({
  stageId,
  count,
  researchId,
  workflowId,
  canSubmit,
  locked,
  review,
}: Props) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState("");
  const workspaces = useQuery({
    queryKey: ["title-proposal-workspaces"],
    queryFn: () => apiClient.get<{ workspaces: any[] }>("/api/workspaces/me"),
    enabled: !review && !researchId,
  });
  const leaderWorkspaces =
    workspaces.data?.workspaces.filter((workspace) =>
      workspace.members.some(
        (member: any) => member.userId === user?.id && member.role === "LEADER",
      ),
    ) || [];
  const [draftResearchId, setDraftResearchId] = useState<string>();
  const projectId = researchId || draftResearchId;
  const [titles, setTitles] = useState<string[]>(Array(count).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["title-proposals", stageId, projectId, review],
    queryFn: () =>
      apiClient.get<{ submissions: any[] }>(
        `/api/workflows/stages/${stageId}/title-proposals${projectId ? `?researchId=${projectId}` : ""}`,
      ),
    enabled: Boolean(review || projectId),
    refetchInterval: 15000,
  });
  const submission = query.data?.submissions[0];
  useEffect(() => {
    if (!review) setTitles(submission?.titles || Array(count).fill(""));
  }, [stageId, count, submission?.id, submission?.version, review]);
  const refresh = async () => {
    await client.invalidateQueries();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let id = projectId;
      if (!id) {
        const result = await apiClient.post<{ project: { id: string } }>(
          `/api/workflows/${workflowId}/participation`,
          {
            ...(workspaceId && { workspaceId }),
          },
        );
        id = result.project.id;
        setDraftResearchId(id);
      }
      await apiClient.post(`/api/workflows/stages/${stageId}/title-proposals`, {
        researchId: id,
        titles,
      });
      await refresh();
    } catch (e: any) {
      setError(e.message || "Unable to submit proposals.");
    } finally {
      setBusy(false);
    }
  };
  const decide = async (item: any, selectedIndex?: number) => {
    setBusy(true);
    setError("");
    try {
      await apiClient.patch(
        `/api/workflows/stages/${stageId}/title-proposals/${item.researchId}/review`,
        {
          version: item.version,
          status:
            selectedIndex === undefined ? "REVISION_REQUIRED" : "APPROVED",
          selectedIndex,
          reviewNote: feedback[item.id] || "",
        },
      );
      await refresh();
    } catch (e: any) {
      setError(e.message || "Unable to record decision.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-primary)]">
      <h3 className="text-lg font-bold">Title Proposal</h3>
      <p className="mt-1 text-sm">
        Submit {count} different proposed titles. Your professor will choose one
        as your registered research project.
      </p>
      {(error || query.isError) && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error || (query.error as Error)?.message}
        </p>
      )}
      {query.isLoading && <p className="mt-3">Loading proposals…</p>}
      {review ? (
        <div className="mt-4 space-y-4">
          {!query.isLoading &&
            !query.isError &&
            !query.data?.submissions.length && (
              <p>No title proposals submitted yet.</p>
            )}
          {query.data?.submissions.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[var(--color-border)] p-4"
            >
              <p className="font-bold">
                {item.research.groupName ||
                  `${item.research.creator.firstName} ${item.research.creator.lastName}`}
              </p>
              <p className="my-2 text-sm">
                {item.status.replaceAll("_", " ")} · Submission {item.version}
              </p>
              {item.titles.map((title: string, index: number) => (
                <div
                  key={index}
                  className="my-2 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-subtle)] p-3"
                >
                  <span>
                    {index + 1}. {title}
                    {item.selectedIndex === index && (
                      <strong className="ml-2 text-emerald-600">
                        Registered Research Project
                      </strong>
                    )}
                  </span>
                  {item.status === "SUBMITTED" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => decide(item, index)}
                      className="shrink-0 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Accept title {index + 1}
                    </button>
                  )}
                </div>
              ))}
              {item.reviewNote && (
                <p className="mt-2 text-sm">Feedback: {item.reviewNote}</p>
              )}
              {item.status === "SUBMITTED" && (
                <div className="mt-3">
                  <label className="block text-sm">
                    Feedback
                    <textarea
                      maxLength={2000}
                      value={feedback[item.id] || ""}
                      onChange={(event) =>
                        setFeedback((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !feedback[item.id]?.trim()}
                    onClick={() => decide(item)}
                    className="mt-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    Request revised titles
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : submission?.status === "APPROVED" ? (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-emerald-900">
          <p className="font-bold">Registered Research Project</p>
          <p className="mt-1">{submission.titles[submission.selectedIndex]}</p>
        </div>
      ) : (
        <>
          {submission?.reviewNote && (
            <p className="mt-3">Professor feedback: {submission.reviewNote}</p>
          )}
          {submission?.status === "SUBMITTED" && (
            <div className="mt-4">
              <p className="font-bold">Awaiting professor review</p>
              <ol className="mt-2 list-inside list-decimal">
                {submission.titles.map((title: string, index: number) => (
                  <li key={index}>{title}</li>
                ))}
              </ol>
            </div>
          )}
          {(!submission || submission.status === "REVISION_REQUIRED") &&
            !query.isError &&
            !query.isLoading && (
              <form onSubmit={submit} className="mt-4 space-y-3">
                {!projectId && leaderWorkspaces.length > 0 && (
                  <label className="block text-sm font-semibold">
                    Submit for
                    <select
                      value={workspaceId}
                      onChange={(event) => setWorkspaceId(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                    >
                      <option value="">My individual research</option>
                      {leaderWorkspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {titles.map((title, index) => (
                  <label key={index} className="block text-sm font-semibold">
                    Title proposal {index + 1}
                    <textarea
                      required
                      minLength={5}
                      maxLength={500}
                      value={title}
                      disabled={busy || locked || !canSubmit}
                      onChange={(event) =>
                        setTitles((current) =>
                          current.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        )
                      }
                      className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal disabled:opacity-60"
                    />
                  </label>
                ))}
                {locked ? (
                  <p>Complete the preceding and required milestones first.</p>
                ) : !canSubmit ? (
                  <p>
                    Only the project leader can submit titles for the group.
                  </p>
                ) : (
                  <button
                    disabled={
                      busy ||
                      titles.some((title) => title.trim().length < 5) ||
                      new Set(titles.map((title) => title.trim().toLowerCase()))
                        .size !== count
                    }
                    className="submission-action rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Submitting…" : "Submit title proposals"}
                  </button>
                )}
              </form>
            )}
        </>
      )}
    </section>
  );
}
