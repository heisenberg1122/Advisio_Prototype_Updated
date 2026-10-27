import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";

export interface TitleProposalReviewTarget {
  stageId: string;
  researchId: string;
  groupName: string;
}

type Proposal = {
  id: string;
  version: number;
  titles: string[];
  status: string;
  selectedIndex: number | null;
  reviewNote: string | null;
};

export function TitleProposalReviewModal({
  target,
  onClose,
}: {
  target: TitleProposalReviewTarget;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);
  const query = useQuery({
    queryKey: ["title-proposals", target.stageId, target.researchId, true],
    queryFn: () =>
      apiClient.get<{ submissions: Proposal[] }>(
        `/api/workflows/stages/${target.stageId}/title-proposals?researchId=${target.researchId}`,
      ),
    refetchInterval: 15000,
  });
  const proposal = query.data?.submissions[0];
  useEffect(() => {
    setSelectedIndex(proposal?.selectedIndex ?? null);
    setFeedback(proposal?.reviewNote || "");
  }, [
    proposal?.id,
    proposal?.version,
    proposal?.status,
    proposal?.selectedIndex,
    proposal?.reviewNote,
  ]);

  const decide = async (status: "APPROVED" | "REVISION_REQUIRED") => {
    if (!proposal || proposal.status !== "SUBMITTED" || busy) return;
    if (status === "APPROVED" && selectedIndex === null) return;
    if (status === "REVISION_REQUIRED" && !feedback.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.patch(
        `/api/workflows/stages/${target.stageId}/title-proposals/${target.researchId}/review`,
        {
          version: proposal.version,
          status,
          ...(status === "APPROVED" && { selectedIndex }),
          reviewNote: feedback.trim(),
        },
      );
      await client.invalidateQueries();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save the title decision.",
      );
      // Reload a concurrent revision/decision before allowing another attempt.
      await client.invalidateQueries({ queryKey: ["title-proposals"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title="Review title proposal"
      subtitle={target.groupName}
      maxWidth="xl"
    >
      {(error || query.isError) && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error || (query.error as Error)?.message}
        </p>
      )}
      {query.isLoading ? (
        <p>Loading proposed titles…</p>
      ) : proposal ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {proposal.status.replace(/_/g, " ")} · Submission {proposal.version}
          </p>
          {proposal.status === "SUBMITTED" && (
            <p>
              Choose one title to register as this group or researcher's
              research project.
            </p>
          )}
          <fieldset
            disabled={busy || proposal.status !== "SUBMITTED"}
            className="space-y-3"
          >
            <legend className="mb-2 font-bold">Proposed titles</legend>
            {proposal.titles.map((title, index) => (
              <label
                key={index}
                className={`flex items-start gap-3 rounded-xl border p-4 ${selectedIndex === index ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}
              >
                <input
                  type="radio"
                  name="approved-proposal-title"
                  value={index}
                  checked={selectedIndex === index}
                  onChange={() => setSelectedIndex(index)}
                  className="mt-1 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">
                    {index + 1}. {title}
                  </span>
                  {proposal.status === "APPROVED" &&
                    proposal.selectedIndex === index && (
                      <span className="mt-1 block text-sm font-bold text-emerald-700">
                        Registered research title
                      </span>
                    )}
                </span>
              </label>
            ))}
          </fieldset>
          {proposal.status === "SUBMITTED" ? (
            <>
              <label className="block text-sm font-semibold">
                Feedback (required when requesting revisions)
                <textarea
                  maxLength={2000}
                  value={feedback}
                  disabled={busy}
                  onChange={(event) => setFeedback(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal"
                  rows={3}
                />
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  disabled={busy || !feedback.trim()}
                  onClick={() => void decide("REVISION_REQUIRED")}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  Request revised titles
                </button>
                <button
                  type="button"
                  disabled={busy || selectedIndex === null}
                  onClick={() => void decide("APPROVED")}
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Approve selected title"}
                </button>
              </div>
            </>
          ) : proposal.reviewNote ? (
            <p className="text-sm">Feedback: {proposal.reviewNote}</p>
          ) : null}
        </div>
      ) : !query.isError ? (
        <p>This group or researcher has no title proposal submission.</p>
      ) : null}
    </Modal>
  );
}
