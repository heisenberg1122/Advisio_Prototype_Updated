import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export function GradingPointsInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2 text-sm text-[var(--color-text-primary)]">
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={value !== ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? "100" : "")}
        />
        Grade this requirement
      </label>
      {value !== "" && (
        <label className="flex items-center gap-3">
          Points
          <input
            type="number"
            min={1}
            max={10000}
            step={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="h-10 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
          />
        </label>
      )}
      <p className="text-xs text-[var(--color-text-secondary)]">
        {value === ""
          ? "Ungraded. Review and approval still apply."
          : "Each submission is graded separately. Points are locked after grading starts."}
      </p>
    </div>
  );
}
export function RequirementGradingSettings({
  task,
  onSaved,
}: {
  task: { id: string; maxPoints?: number | null };
  onSaved: (value: number | null) => void;
}) {
  const [points, setPoints] = useState(
    task.maxPoints == null ? "" : String(task.maxPoints),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => setPoints(task.maxPoints == null ? "" : String(task.maxPoints)),
    [task.id, task.maxPoints],
  );
  const changed =
    points !== (task.maxPoints == null ? "" : String(task.maxPoints));
  const valid =
    points === "" ||
    (Number.isInteger(Number(points)) &&
      Number(points) >= 1 &&
      Number(points) <= 10000);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.patch(`/api/workflows/tasks/${task.id}/grading`, {
        maxPoints: points === "" ? null : Number(points),
      });
      onSaved(points === "" ? null : Number(points));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update grading.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
      <GradingPointsInput value={points} onChange={setPoints} disabled={busy} />
      {changed && (
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() => void save()}
          className="mt-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-[var(--college-on-primary)] disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save grading settings"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
