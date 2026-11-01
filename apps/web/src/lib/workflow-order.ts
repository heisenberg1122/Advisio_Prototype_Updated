export type MilestonePosition = { id: string; topicId: string | null };

export function buildMilestoneMove(
  stages: MilestonePosition[],
  topicIds: string[],
  stageId: string,
  topicId: string | null,
  beforeStageId: string | null,
): MilestonePosition[] {
  const source = stages.find((stage) => stage.id === stageId);
  if (!source || (topicId !== null && !topicIds.includes(topicId)))
    throw new Error("Choose a milestone and phase from this workflow.");
  if (beforeStageId === stageId) return stages;
  const remaining = stages.filter((stage) => stage.id !== stageId);
  let index: number;
  if (beforeStageId) {
    index = remaining.findIndex(
      (stage) => stage.id === beforeStageId && stage.topicId === topicId,
    );
    if (index < 0)
      throw new Error("Choose a position in the destination phase.");
  } else {
    const siblings = remaining.filter((stage) => stage.topicId === topicId);
    const last = siblings.at(-1);
    const topicIndex = topicId ? topicIds.indexOf(topicId) : -1;
    index = last
      ? remaining.findIndex((stage) => stage.id === last.id) + 1
      : remaining.findIndex(
          (stage) =>
            stage.topicId !== null &&
            topicIds.indexOf(stage.topicId) > topicIndex,
        );
    if (index < 0) index = remaining.length;
  }
  return [
    ...remaining.slice(0, index),
    { id: stageId, topicId },
    ...remaining.slice(index),
  ];
}
