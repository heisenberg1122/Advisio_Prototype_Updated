export interface WorkflowStageLike {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  sequence: number;
  deadlineDays?: number | null;
  requiresApproval?: boolean;
  isFinal?: boolean;
  topic?: { id: string; title: string } | null;
}

export interface WorkflowProjectLike {
  status?: string | null;
  workflowInstance?: {
    startedAt?: string | null;
    completedAt?: string | null;
    currentStage?: WorkflowStageLike | null;
    workflow?: { stages?: WorkflowStageLike[] | null } | null;
  } | null;
}

export interface MilestoneProgressLike {
  completedRequirements?: number | null;
  totalRequirements?: number | null;
}

export function calculateMilestoneProgress(
  milestones?: MilestoneProgressLike[] | null,
  workflowCompleted = false,
) {
  if (workflowCompleted) return 100;

  const totals = (milestones || []).reduce(
    (value, milestone) => ({
      completed: value.completed + Math.max(0, milestone.completedRequirements || 0),
      total: value.total + Math.max(0, milestone.totalRequirements || 0),
    }),
    { completed: 0, total: 0 },
  );

  return totals.total
    ? Math.min(100, Math.max(0, Math.round((totals.completed / totals.total) * 100)))
    : 0;
}

export function getOrderedWorkflowStages(project?: WorkflowProjectLike | null) {
  return [...(project?.workflowInstance?.workflow?.stages || [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
}

export function calculateWorkflowProgress(project?: WorkflowProjectLike | null) {
  if (!project) return 0;
  if (project.status === "COMPLETED" || project.workflowInstance?.completedAt) return 100;

  const stages = getOrderedWorkflowStages(project);
  const currentSequence = project.workflowInstance?.currentStage?.sequence || 0;
  return stages.length
    ? Math.min(100, Math.max(0, Math.round((currentSequence / stages.length) * 100)))
    : 0;
}

export type TimelineStage = WorkflowStageLike & {
  startDate: Date;
  endDate: Date;
  durationDays: number;
  status: "completed" | "active" | "upcoming";
};

export function buildWorkflowTimeline(project?: WorkflowProjectLike | null): TimelineStage[] {
  const stages = getOrderedWorkflowStages(project);
  if (!stages.length) return [];

  const currentSequence = project?.workflowInstance?.currentStage?.sequence || 0;
  const completed = project?.status === "COMPLETED" || Boolean(project?.workflowInstance?.completedAt);
  let cursor = project?.workflowInstance?.startedAt
    ? new Date(project.workflowInstance.startedAt)
    : new Date();

  return stages.map((stage) => {
    const durationDays = Math.max(1, stage.deadlineDays || 14);
    const startDate = new Date(cursor);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    cursor = new Date(endDate);

    return {
      ...stage,
      startDate,
      endDate,
      durationDays,
      status: completed || stage.sequence < currentSequence
        ? "completed"
        : stage.sequence === currentSequence
          ? "active"
          : "upcoming",
    };
  });
}
