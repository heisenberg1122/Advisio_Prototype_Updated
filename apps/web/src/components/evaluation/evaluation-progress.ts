type Store = Pick<Storage, "getItem" | "setItem">;
export type EvaluationProgress = {
  phase: "intro" | "activities" | "complete";
  checked: number[];
};
export function readProgress(
  projectId: string,
  taskCount: number,
  storage: Store = localStorage,
): EvaluationProgress {
  try {
    const value = JSON.parse(
      storage.getItem(`advisio_evaluation_guide:${projectId}`) || "null",
    );
    const phase = value?.phase === "questionnaire" ? "complete" : value?.phase;
    if (phase !== "intro" && phase !== "activities" && phase !== "complete")
      throw new Error();
    return {
      phase,
      checked: [
        ...new Set<number>(
          (Array.isArray(value.checked) ? value.checked : []).filter(
            (n: unknown) =>
              Number.isInteger(n) && Number(n) >= 0 && Number(n) < taskCount,
          ),
        ),
      ],
    };
  } catch {
    return { phase: "intro", checked: [] };
  }
}
export function saveProgress(
  projectId: string,
  progress: EvaluationProgress,
  storage: Store = localStorage,
) {
  try {
    storage.setItem(
      `advisio_evaluation_guide:${projectId}`,
      JSON.stringify(progress),
    );
  } catch {
    /* The guide still works when browser storage is unavailable. */
  }
}
