const DAY_MS = 86_400_000;
export const WORKFLOW_TIME_ZONE = "Asia/Manila";

type StageDeadline = {
  id?: string;
  deadlineDays?: number | null;
  targetCompletionDate?: string | null;
};

// Prisma serializes a DATE column as midnight UTC. Keep its calendar part intact.
export function calendarDateValue(value?: string | null): string {
  return value?.slice(0, 10) || "";
}

export function targetCompletionEnd(value?: string | null): Date | null {
  const date = calendarDateValue(value);
  return date ? new Date(`${date}T23:59:59.999+08:00`) : null;
}

export function formatTargetCompletionDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: WORKFLOW_TIME_ZONE,
  }).format(targetCompletionEnd(value)!);
}

export function formatMilestoneTarget(stage: StageDeadline): string {
  if (stage.targetCompletionDate)
    return `Due ${formatTargetCompletionDate(stage.targetCompletionDate)}`;
  return stage.deadlineDays != null
    ? `${stage.deadlineDays} day target`
    : "No target date";
}

export function formatTaskDeadline(task: {
  dueDays?: number | null;
  stage?: StageDeadline;
}): string {
  if (task.stage?.targetCompletionDate)
    return `Due ${formatTargetCompletionDate(task.stage.targetCompletionDate)}`;
  const days = task.dueDays ?? task.stage?.deadlineDays;
  return days != null
    ? `Within ${days} days of availability`
    : "No deadline set";
}

export function resolveWorkflowDeadline({
  stages,
  stageIndex,
  startedAt,
  transitions = [],
  dueDays,
}: {
  stages: StageDeadline[];
  stageIndex: number;
  startedAt?: string | null;
  transitions?: Array<{ toStageId: string; createdAt: string }>;
  dueDays?: number | null;
}): { dueAt: Date | null; projected: boolean } {
  const stage = stages[stageIndex];
  const fixedDate = targetCompletionEnd(stage.targetCompletionDate);
  if (fixedDate) return { dueAt: fixedDate, projected: false };

  const transition = transitions.find((item) => item.toStageId === stage.id);
  const actualActivation = transition?.createdAt
    ? new Date(transition.createdAt)
    : stageIndex === 0 && startedAt
      ? new Date(startedAt)
      : null;
  let activation = actualActivation;
  if (!activation && startedAt) {
    activation = new Date(startedAt);
    for (const previous of stages.slice(0, stageIndex)) {
      const previousTarget = targetCompletionEnd(previous.targetCompletionDate);
      activation = previousTarget
        ? new Date(previousTarget.getTime() + 1)
        : new Date(
            activation.getTime() + Number(previous.deadlineDays || 0) * DAY_MS,
          );
    }
  }
  const days = dueDays ?? stage.deadlineDays;
  return {
    dueAt:
      activation && days != null
        ? new Date(activation.getTime() + days * DAY_MS)
        : null,
    projected: !actualActivation && Boolean(startedAt),
  };
}
