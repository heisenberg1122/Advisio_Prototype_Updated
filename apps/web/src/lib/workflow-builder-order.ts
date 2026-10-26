export type WorkflowOrderItem = {
  id: string;
  topicId: string | null;
  sequence: number;
};

function bySequence<T extends WorkflowOrderItem>(left: T, right: T) {
  return left.sequence - right.sequence;
}

export function milestonesInGroup<T extends WorkflowOrderItem>(
  milestones: T[],
  topicId: string | null,
) {
  return milestones
    .filter((milestone) => milestone.topicId === topicId)
    .sort(bySequence);
}

export function flattenWorkflowMilestones<T extends WorkflowOrderItem>(
  milestones: T[],
  topicIds: string[],
) {
  const knownTopicIds = new Set(topicIds);
  const ordered = topicIds.flatMap((topicId) =>
    milestonesInGroup(milestones, topicId),
  );
  ordered.push(
    ...milestones
      .filter(
        (milestone) =>
          milestone.topicId === null || !knownTopicIds.has(milestone.topicId),
      )
      .sort(bySequence),
  );
  return ordered.map((milestone, index) => ({
    ...milestone,
    sequence: index + 1,
  }));
}

export function moveWorkflowMilestone<T extends WorkflowOrderItem>(
  milestones: T[],
  topicIds: string[],
  milestoneId: string,
  targetTopicId: string | null,
  requestedIndex: number,
) {
  const source = milestones.find((milestone) => milestone.id === milestoneId);
  if (!source) return flattenWorkflowMilestones(milestones, topicIds);

  const knownTopicIds = new Set(topicIds);
  const normalizedTopicId = (topicId: string | null) =>
    topicId && knownTopicIds.has(topicId) ? topicId : null;
  const sourceGroup = milestonesInGroup(milestones, source.topicId);
  const sourceIndex = sourceGroup.findIndex(
    (milestone) => milestone.id === milestoneId,
  );
  const groups = new Map<string | null, T[]>([
    ...topicIds.map((topicId) => [topicId, [] as T[]] as const),
    [null, [] as T[]],
  ]);
  milestones
    .filter((milestone) => milestone.id !== milestoneId)
    .sort(bySequence)
    .forEach((milestone) => {
      groups.get(normalizedTopicId(milestone.topicId))!.push(milestone);
    });
  const targetGroup = groups.get(normalizedTopicId(targetTopicId))!;
  const adjustedIndex =
    source.topicId === targetTopicId && sourceIndex < requestedIndex
      ? requestedIndex - 1
      : requestedIndex;
  const insertionIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(adjustedIndex) ? adjustedIndex : targetGroup.length,
      targetGroup.length,
    ),
  );
  targetGroup.splice(insertionIndex, 0, { ...source, topicId: targetTopicId });
  return [...topicIds.flatMap((topicId) => groups.get(topicId)!), ...groups.get(null)!].map(
    (milestone, index) => ({ ...milestone, sequence: index + 1 }),
  );
}

export function moveWorkflowTopic<T extends { id: string }>(
  topics: T[],
  topicId: string,
  requestedIndex: number,
) {
  const sourceIndex = topics.findIndex((topic) => topic.id === topicId);
  if (sourceIndex < 0) return [...topics];
  const next = [...topics];
  const [source] = next.splice(sourceIndex, 1);
  const adjustedIndex =
    sourceIndex < requestedIndex ? requestedIndex - 1 : requestedIndex;
  next.splice(Math.max(0, Math.min(adjustedIndex, next.length)), 0, source);
  return next;
}
