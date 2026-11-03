import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatReviewDateTime } from "@/lib/review-date";
import { Modal } from "@/components/ui/Modal";

type Person = { id: string; firstName: string; lastName: string };
type Grade = {
  maxPoints: number;
  draftScore?: number | null;
  releasedScore: number | null;
  revision?: number;
  releasedAt?: string | null;
  releasedBy?: Person | null;
  updatedAt?: string;
  updatedBy?: Person;
  draftSavedAt?: string;
  draftSavedBy?: Person;
};
type GradeInfo = {
  maxPoints: number | null;
  canGrade: boolean;
  grade: Grade | null;
  submittedAt: string;
  submittedBy: Person;
};
type Entry = {
  id: string;
  action: string;
  at: string;
  actor: Person | null;
  detail?: string;
};
const name = (person?: Person | null) =>
  person ? `${person.firstName} ${person.lastName}` : "Faculty reviewer";

export function useSubmissionGrade(
  submissionId?: string,
  versionId?: string,
  refetchInterval: number | false = false,
) {
  return useQuery({
    queryKey: ["submission-grade", submissionId, versionId],
    queryFn: () =>
      apiClient.get<GradeInfo>(`/api/workflows/tasks/submissions/${submissionId}/grade`, {
        params: { documentVersionId: versionId },
      }),
    enabled: Boolean(submissionId && versionId),
    refetchInterval,
  });
}

export function SubmissionGradePanel({
  submissionId,
  versionId,
  researcherTask = false,
}: {
  submissionId: string;
  versionId: string;
  researcherTask?: boolean;
}) {
  const client = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [score, setScore] = useState("");
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const endpoint = `/api/workflows/tasks/submissions/${submissionId}`;
  const query = useSubmissionGrade(submissionId, versionId, 15000);
  const info = query.data;
  const history = useQuery({
    queryKey: ["submission-history", submissionId, versionId],
    queryFn: () =>
      apiClient.get<{ events: Entry[] }>(`${endpoint}/history`, {
        params: { documentVersionId: versionId },
      }),
    enabled: historyOpen,
    refetchInterval: historyOpen ? 15000 : false,
  });
  useEffect(() => {
    if (!info || dirty) return;
    setScore(
      info.grade?.draftScore == null ? "" : String(info.grade.draftScore),
    );
    setRevision(info.grade?.revision || 0);
  }, [info, dirty]);
  const mutation = useMutation({
    mutationFn: (action: "SAVE_DRAFT" | "RELEASE") =>
      apiClient.patch(`${endpoint}/grade`, {
        action,
        documentVersionId: versionId,
        expectedRevision: revision,
        ...(action === "SAVE_DRAFT" ? { score: Number(score) } : {}),
      }),
    onSuccess: async (_data, action) => {
      setDirty(false);
      setNotice(
        action === "SAVE_DRAFT"
          ? "Draft grade saved. Only the professor can see it."
          : "Grade released to the research group.",
      );
      await Promise.all([
        query.refetch(),
        client.invalidateQueries({
          queryKey: ["submission-history", submissionId],
        }),
      ]);
    },
  });
  const points = info?.maxPoints;
  const showGrade = !researcherTask ||
    (points != null && info?.grade?.releasedScore != null && Boolean(info.grade.releasedAt));
  const validScore =
    score.trim() !== "" &&
    Number.isFinite(Number(score)) &&
    Number(score) >= 0 &&
    Number(score) <= (points || 0) &&
    Math.abs(Number(score) * 100 - Math.round(Number(score) * 100)) < 0.000001;
  return (
    <section
      aria-label={showGrade ? "Grade and submission history" : "Submission history"}
      className={researcherTask && showGrade
        ? "space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        : "space-y-3"}
    >
      {query.isLoading && (
        <p role="status" className="text-sm">
          Loading grade…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="text-sm text-rose-600">
          <p>{query.error.message}</p>
          <button
            type="button"
            className="mt-1 font-semibold underline"
            onClick={() => void query.refetch()}
          >
            Retry grade
          </button>
        </div>
      )}
      {info && (
        <>
          {showGrade && <div className="text-xs leading-5 text-[var(--color-text-secondary)]">
            <p>Turned in by {name(info.submittedBy)}</p>
            <time dateTime={info.submittedAt}>
              {formatReviewDateTime(info.submittedAt)}
            </time>
            <span className="block">Philippine time</span>
          </div>}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)]"
          >
            <History size={15} />
            See history
          </button>
          {showGrade && <div className="border-t border-[var(--color-border)] pt-3">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Grade
            </h3>
            {points == null ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Ungraded requirement.
                {info.canGrade
                  ? " Set points in the milestone's submission requirements to enable grading."
                  : ""}
              </p>
            ) : info.canGrade ? (
              <>
                <label className="mt-3 block text-sm font-semibold text-[var(--color-text-primary)]">
                  Score
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
                    <input
                      type="number"
                      min={0}
                      max={points}
                      step="0.01"
                      value={score}
                      onChange={(event) => {
                        setScore(event.target.value);
                        setDirty(true);
                        setNotice("");
                      }}
                      disabled={mutation.isPending}
                      aria-label="Grade score"
                      className="h-11 min-w-0 flex-1 bg-transparent font-normal outline-none"
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      / {points}
                    </span>
                  </div>
                </label>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Save a private draft, then release it when ready. Grading does
                  not approve the submission.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!validScore || mutation.isPending || !dirty}
                    onClick={() => mutation.mutate("SAVE_DRAFT")}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    Save draft grade
                  </button>
                  <button
                    type="button"
                    disabled={
                      dirty ||
                      info.grade?.draftScore == null ||
                      mutation.isPending ||
                      info.grade?.releasedScore === info.grade?.draftScore
                    }
                    onClick={() => mutation.mutate("RELEASE")}
                    className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-40"
                  >
                    Release grade
                  </button>
                </div>
                {info.grade?.draftSavedAt && (
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                    Draft saved by {name(info.grade.draftSavedBy)}
                    <br />
                    <time dateTime={info.grade.draftSavedAt}>
                      {formatReviewDateTime(info.grade.draftSavedAt)}
                    </time>
                  </p>
                )}
              </>
            ) : (
              !info.grade?.releasedAt && (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Grade not released yet · {points} points
                </p>
              )
            )}
            {info.grade?.releasedAt && (
              <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                <p className="font-bold text-[var(--color-text-primary)]">
                  Released grade: {info.grade.releasedScore}/
                  {info.grade.maxPoints}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  Released by {name(info.grade.releasedBy)}
                  <br />
                  <time dateTime={info.grade.releasedAt}>
                    {formatReviewDateTime(info.grade.releasedAt)}
                  </time>
                </p>
              </div>
            )}
          </div>}
        </>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-rose-600">
          {mutation.error.message}
        </p>
      )}
      <p role="status" className="text-sm text-[var(--color-text-secondary)]">
        {notice}
      </p>
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Submission history"
        subtitle="Submission, review, comment, and grade activity · Philippine time"
        maxWidth="xl"
      >
        {history.isLoading && <p role="status">Loading history…</p>}
        {history.isError && (
          <div role="alert">
            <p>{history.error.message}</p>
            <button
              type="button"
              onClick={() => void history.refetch()}
              className="mt-2 font-semibold underline"
            >
              Retry history
            </button>
          </div>
        )}
        {history.data && (
          <ol className="space-y-3">
            {history.data.events.map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold text-[var(--color-text-primary)]">
                    {event.action}
                    {event.detail ? ` · ${event.detail}` : ""}
                  </p>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {name(event.actor)}
                  </span>
                </div>
                <time
                  dateTime={event.at}
                  className="mt-1 block text-sm text-[var(--color-text-secondary)]"
                >
                  {formatReviewDateTime(event.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </section>
  );
}
