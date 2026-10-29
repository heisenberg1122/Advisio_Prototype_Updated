import { useState } from "react";
import { evaluationButton, evaluationCard } from "./StructuredEvaluationFields";

export type EvaluationCheckpoint = {
  format: "advisio-evaluation-checkpoint-v1";
  defenseSessionId: string;
  sequence: number;
  eventHash: string;
};
export type IntegrityReport = {
  status: "LEGACY" | "CHAIN_VALID" | "CHECKPOINT_MATCH" | "MISMATCH";
  checkedAt: string;
  eventCount: number;
  issues: string[];
  checkpointSequence: number | null;
  checkpointCoversHead: boolean;
  head: EvaluationCheckpoint | null;
  history: {
    sequence: number;
    eventType: string;
    occurredAt: string;
    eventHash: string;
  }[];
};

const labels = {
  LEGACY: "Legacy records · Outside ledger coverage",
  CHAIN_VALID: "Internal chain valid · No retained checkpoint compared",
  CHECKPOINT_MATCH: "History matches supplied checkpoint",
  MISMATCH: "Integrity mismatch · Review required",
};

export function EvaluationIntegrity({
  report,
  error,
  busy,
  student = false,
  onVerify,
  onCheckpoint,
}: {
  report?: IntegrityReport;
  error?: string;
  busy: boolean;
  student?: boolean;
  onVerify: () => void;
  onCheckpoint: (checkpoint: EvaluationCheckpoint) => Promise<void>;
}) {
  const [fileError, setFileError] = useState("");
  const [exported, setExported] = useState<EvaluationCheckpoint | null>(null);
  const exportCheckpoint = () => {
    if (!report?.head || report.status === "MISMATCH") return;
    const blob = new Blob([JSON.stringify(report.head, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `evaluation-checkpoint-${report.head.defenseSessionId}-${report.head.sequence}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(report.head);
  };
  const compare = async (checkpoint: EvaluationCheckpoint) => {
    setFileError("");
    try {
      await onCheckpoint(checkpoint);
    } catch (e) {
      setFileError(
        e instanceof Error ? e.message : "Unable to verify checkpoint.",
      );
    }
  };
  return (
    <section className={evaluationCard} aria-label="Evaluation integrity">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Evaluation integrity</h3>
        <button className={evaluationButton} disabled={busy} onClick={onVerify}>
          Verify records
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2">
          Verification unavailable: {error}
        </p>
      ) : !report ? (
        <p className="mt-2">Checking evaluation records…</p>
      ) : (
        <>
          <p className="mt-2 font-semibold" role="status">
            {labels[report.status]}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {report.eventCount} records · Checked{" "}
            {new Date(report.checkedAt).toLocaleString()}
          </p>
          {report.checkpointSequence && (
            <p className="mt-2 text-sm">
              Compared through record {report.checkpointSequence}
              {report.checkpointCoversHead
                ? " (current history)."
                : ". Later records are outside this checkpoint’s coverage."}
            </p>
          )}
          {report.issues.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm" role="alert">
              {report.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}
          {!student && report.status !== "LEGACY" && (
            <>
              <p className="mt-3 text-sm">
                Retain a checkpoint file outside Advisio before releasing the
                result. Upload a previously retained file to compare history
                later. A matching file establishes agreement with that file; the
                system cannot verify who retained it.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  className={evaluationButton}
                  disabled={busy || report.status === "MISMATCH"}
                  onClick={exportCheckpoint}
                >
                  Download checkpoint
                </button>
                <label className={`${evaluationButton} cursor-pointer`}>
                  Compare retained checkpoint
                  <input
                    aria-label="Compare retained checkpoint"
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    disabled={busy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      if (file.size > 4096) {
                        setFileError("Checkpoint files must be at most 4 KB.");
                        return;
                      }
                      try {
                        await compare(JSON.parse(await file.text()));
                      } catch {
                        setFileError("Select a valid JSON checkpoint file.");
                      }
                    }}
                  />
                </label>
              </div>
              {exported && (
                <button
                  className={`${evaluationButton} mt-3`}
                  disabled={busy}
                  onClick={() => void compare(exported)}
                >
                  I retained this checkpoint outside Advisio · Compare it
                </button>
              )}
              {fileError && (
                <p role="alert" className="mt-2">
                  {fileError}
                </p>
              )}
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer">Evaluation history</summary>
                <ol className="mt-2 space-y-2">
                  {report.history.map((event) => (
                    <li key={event.sequence}>
                      #{event.sequence} ·{" "}
                      {event.eventType.replace(/_/g, " ").toLowerCase()} ·{" "}
                      {new Date(event.occurredAt).toLocaleString()}
                      <code className="block break-all text-xs">
                        {event.eventHash}
                      </code>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
