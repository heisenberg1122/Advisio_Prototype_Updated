const DAY = 86_400_000;
export function reminderDays(dueAt: Date, now = new Date()) {
  const days = Math.ceil((dueAt.getTime() - now.getTime()) / DAY);
  return days === 3 || days === 1 ? days : null;
}

export function requirementDeadline(
  stage: { targetCompletionDate: Date | null; deadlineDays: number | null },
  activatedAt: Date | null,
  dueDays?: number | null,
) {
  if (stage.targetCompletionDate)
    return new Date(
      `${stage.targetCompletionDate.toISOString().slice(0, 10)}T23:59:59.999+08:00`,
    );
  const days = dueDays ?? stage.deadlineDays;
  return activatedAt && days != null
    ? new Date(activatedAt.getTime() + days * DAY)
    : null;
}
