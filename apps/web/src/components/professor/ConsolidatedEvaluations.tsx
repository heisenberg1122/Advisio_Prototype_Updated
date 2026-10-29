import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defenseResults,
  defenseResultLabels,
  type DefenseResult,
} from "@research-management/validations";
import { apiClient } from "@/lib/api-client";
import {
  evaluationCard,
  evaluationInput,
  evaluationButton,
} from "@/components/defense/StructuredEvaluationFields";
export function ConsolidatedEvaluations({
  sessionId,
  student = false,
}: {
  sessionId: string;
  student?: boolean;
}) {
  const queryClient = useQueryClient(),
    [decision, setDecision] = useState<DefenseResult | "">(""),
    [instructions, setInstructions] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [clearanceVersion, setClearanceVersion] = useState("");
  const query = useQuery({
    queryKey: ["structured-results", sessionId],
    queryFn: () =>
      apiClient.get<any>(
        `/api/defense-sessions/${sessionId}/structured-results`,
      ),
    refetchInterval: student ? false : 5000,
  });
  const report = query.data?.report,
    fmt = (n: number | null | undefined) =>
      n == null ? "Pending" : n.toFixed(2);
  const release = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/api/defense-sessions/${sessionId}/release`, {
        decision,
        revisionInstructions: instructions,
      });
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["defense-management"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(
        `/api/defense-sessions/${sessionId}/revision-clearance`,
        { versionId: clearanceVersion, notes: instructions },
      );
      await query.refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (query.isPending) return <p>Loading consolidated evaluations…</p>;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return (
    <div className="space-y-4">
      <section className={evaluationCard}>
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="font-bold">Consolidated evaluations</h3>
          <span className="text-sm">
            {report.submitted} / {report.required} required evaluations
            submitted ·{" "}
            {report.final ? "Final averages" : "Provisional averages"}
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Equal weighting across submitted required panelists. Missing
          submissions are excluded, never counted as zero.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left">Evaluation</th>
                {report.panels.map((p: any) => (
                  <th key={p.userId} className="p-3 text-right">
                    {p.name}
                    <span className="block text-xs font-normal">
                      {p.required ? "Required" : "Optional · excluded"}
                    </span>
                  </th>
                ))}
                <th className="bg-[var(--color-surface-muted)] p-3 text-right">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ...report.researchers,
                {
                  userId: "manuscript",
                  name: "Group manuscript",
                  ...report.manuscript,
                },
              ].map((r: any) => (
                <tr
                  key={r.userId}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="p-3">
                    {r.name}
                    <span className="block text-xs text-[var(--color-text-secondary)]">
                      Out of {r.maximum.toFixed(2)}
                    </span>
                  </td>
                  {report.panels.map((p: any) => (
                    <td key={p.userId} className="p-3 text-right tabular-nums">
                      {fmt(
                        r.userId === "manuscript"
                          ? p.totals?.manuscript.score
                          : p.totals?.researchers.find(
                              (t: any) => t.userId === r.userId,
                            )?.score,
                      )}
                    </td>
                  ))}
                  <td className="bg-[var(--color-surface-muted)] p-3 text-right font-bold tabular-nums">
                    {fmt(r.average)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={evaluationCard}>
        <h3 className="font-bold">Recommended defense results</h3>
        {report.panels.map((p: any) => (
          <details
            key={p.userId}
            className="mt-3 border-t border-[var(--color-border)] pt-3"
          >
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold">{p.name}</span> ·{" "}
              {p.submitted
                ? defenseResultLabels[p.answers.recommendation as DefenseResult]
                : "Pending submission"}
              {p.submitted ? " · Locked" : ""}
            </summary>
            {p.submitted && (
              <div className="mt-3">
                <p className="whitespace-pre-wrap text-sm">
                  {p.answers.feedback || "No additional feedback."}
                </p>
                {!student && (
                  <EvaluationPdfButton
                    sessionId={sessionId}
                    panelistId={p.userId}
                  />
                )}
              </div>
            )}
          </details>
        ))}
      </section>
      <section className={evaluationCard}>
        <h3 className="font-bold">Official defense result</h3>
        <p className="mt-2">
          {query.data.releasedAt
            ? defenseResultLabels[query.data.decision as DefenseResult]
            : "Not released"}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Panelist recommendations and averages do not automatically determine
          the official decision.
        </p>
        {!student && !query.data.releasedAt && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              Official decision
              <select
                aria-label="Official defense result"
                className={`${evaluationInput} mt-2`}
                value={decision}
                onChange={(e) => setDecision(e.target.value as DefenseResult)}
              >
                <option value="">Select the official result</option>
                {defenseResults.map((r) => (
                  <option key={r} value={r}>
                    {defenseResultLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            {decision &&
              [
                "APPROVED_WITH_MINOR_REVISIONS",
                "MAJOR_REVISIONS_REQUIRED",
                "REDEFENSE_REQUIRED",
              ].includes(decision) && (
                <label className="block text-sm">
                  Required revisions / re-defense instructions
                  <textarea
                    rows={3}
                    className={`${evaluationInput} mt-2`}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </label>
              )}
            <button
              disabled={!report.final || !decision || busy}
              className={`${evaluationButton} bg-[var(--color-primary)] text-white`}
              onClick={release}
            >
              Release official result
            </button>
          </div>
        )}
        {query.data.revisionClearance && (
          <p className="mt-3 text-sm">
            Revisions cleared on{" "}
            {new Date(
              query.data.revisionClearance.clearedAt,
            ).toLocaleDateString()}
            . The original defense decision is retained.
          </p>
        )}
        {!student &&
          query.data.releasedAt &&
          !query.data.revisionClearance &&
          [
            "APPROVED_WITH_MINOR_REVISIONS",
            "MAJOR_REVISIONS_REQUIRED",
          ].includes(query.data.decision) && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold">
                Clear approved post-defense revisions
              </h4>
              <select
                aria-label="Approved revised manuscript"
                className={evaluationInput}
                value={clearanceVersion}
                onChange={(e) => setClearanceVersion(e.target.value)}
              >
                <option value="">Select a newer approved manuscript</option>
                {query.data.clearanceCandidates?.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.fileName} · Version {v.versionNumber}
                  </option>
                ))}
              </select>
              <textarea
                aria-label="Revision clearance notes"
                className={evaluationInput}
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Record how the approved version satisfies the required revisions."
              />
              <button
                disabled={
                  busy || !clearanceVersion || instructions.trim().length < 10
                }
                className={`submission-action ${evaluationButton}`}
                onClick={clear}
              >
                Confirm revision clearance
              </button>
            </div>
          )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
export async function openEvaluationPdf(sessionId: string, panelistId: string) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(
    `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/defense-sessions/${sessionId}/structured-evaluations/${panelistId}/pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) throw new Error("Unable to load the evaluation PDF.");
  return URL.createObjectURL(await response.blob());
}
function EvaluationPdfButton({
  sessionId,
  panelistId,
}: {
  sessionId: string;
  panelistId: string;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <button
        className={`${evaluationButton} mt-3`}
        onClick={async () => {
          try {
            const url = await openEvaluationPdf(sessionId, panelistId);
            const a = document.createElement("a");
            a.href = url;
            a.download = "defense-evaluation.pdf";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        Download locked evaluation PDF
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
