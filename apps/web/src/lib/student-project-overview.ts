export interface ProjectTaskProgress {
  id: string;
  title: string;
  isRequired?: boolean;
  status?: string | null;
  submissionId?: string | null;
}

export interface ProjectMilestoneProgress {
  id: string;
  name: string;
  sequence: number;
  isCurrent?: boolean;
  completed?: boolean;
  status?: string | null;
  requiresDocument?: boolean;
  requiresApproval?: boolean;
  isBlocked?: boolean;
  requiredMilestone?: { id: string; name: string; completed: boolean } | null;
  tasks?: ProjectTaskProgress[];
}

export interface OverviewProject {
  workflowDraft?: boolean;
  registeredAt?: string | Date | null;
  id: string;
  title?: string | null;
  status?: string;
  workflowAccessRemoved?: boolean;
  titleRevisions?: Array<{
    proposedTitle: string;
    status: string;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
  }>;
  workflowInstance?: {
    completedAt?: string | null;
    currentStage?: { id: string; name: string } | null;
    workflow?: { name?: string } | null;
  } | null;
}

export type ProjectAction =
  | { kind: "task"; taskId: string }
  | {
      kind: "tasks" | "timeline" | "defense" | "edit" | "retry";
    };

export interface ProjectNextStep {
  label: string;
  title: string;
  description: string;
  tone: "action" | "pending" | "success" | "neutral";
  action?: ProjectAction;
  buttonLabel?: string;
}

export function researchTitleLabel(
  project: Pick<OverviewProject, "title" | "titleRevisions" | "registeredAt" | "workflowDraft">,
) {
  if (project.workflowDraft) return "Research title not registered";
  if (project.registeredAt) return "Registered Research Project";
  if (!project.title?.trim()) return "Research title not added";
  const approved = project.titleRevisions?.some(
    (revision) =>
      revision.status === "ACCEPTED" &&
      revision.proposedTitle === project.title &&
      Boolean(revision.reviewedBy && revision.reviewedAt),
  );
  return approved ? "Approved research title" : "Proposed research title";
}

export function resolveProjectNextStep({
  project,
  milestones,
  loading,
  error,
  isLeader,
}: {
  project: OverviewProject;
  milestones?: ProjectMilestoneProgress[];
  loading?: boolean;
  error?: boolean;
  isLeader: boolean;
}): ProjectNextStep {
  if (project.workflowAccessRemoved)
    return {
      label: "Workflow access removed",
      title: "Contact your professor",
      description:
        "Your professor removed your access to this workflow. Its tasks and resources are unavailable.",
      tone: "neutral",
    };
  if (project.status === "REJECTED")
    return {
      label: "Your next step",
      title: isLeader
        ? "Revise your proposed title"
        : "Your proposed title needs revision",
      description: isLeader
        ? "Review the decision and update this project without losing its files or history."
        : "Your group leader can revise the proposed title. Coordinate with your team before continuing.",
      tone: "action",
      ...(isLeader
        ? { action: { kind: "edit" as const }, buttonLabel: "Revise title" }
        : {}),
    };
  if (!project.workflowInstance)
    return {
      label: "Workflow unavailable",
      title: "No workflow linked to this project",
      description:
        "Contact your professor to confirm the workflow assigned to this project.",
      tone: "neutral",
    };
  if (loading)
    return {
      label: "Your next step",
      title: "Checking your progress…",
      description: "Loading the latest milestone and submission status.",
      tone: "neutral",
    };
  if (error || !milestones)
    return {
      label: "Progress unavailable",
      title: "Your next step could not be loaded",
      description:
        "Try again to check the latest requirements and review decisions.",
      tone: "neutral",
      action: { kind: "retry" },
      buttonLabel: "Retry",
    };
  if (project.workflowInstance.completedAt)
    return {
      label: "Workflow completed",
      title: "Your workflow requirements are complete",
      description:
        "Check the Defense page for the remaining eligibility requirements and scheduling details.",
      tone: "success",
      action: { kind: "defense" },
      buttonLabel: "View defense requirements",
    };
  const current =
    milestones.find(
      (stage) => stage.id === project.workflowInstance?.currentStage?.id,
    ) || milestones.find((stage) => stage.isCurrent);
  if (!current)
    return {
      label: "Your next step",
      title: "Check your workflow requirements",
      description:
        "No current milestone is available. Open Tasks & Requirements or contact your professor.",
      tone: "neutral",
      action: { kind: "tasks" },
      buttonLabel: "View requirements",
    };
  if (current.isBlocked)
    return {
      label: "Required milestone condition",
      title: `Complete ${current.requiredMilestone?.name || "the required milestone"} first`,
      description: `${current.name} opens after its required milestone is completed and approved.`,
      tone: "pending",
      action: { kind: "tasks" },
      buttonLabel: "View requirements",
    };
  const required = (current.tasks || []).filter(
    (task) => task.isRequired !== false,
  );
  const taskAction = (task?: ProjectTaskProgress): ProjectAction => ({
    kind: "task",
    taskId: task?.id || `milestone-${current.id}`,
  });
  const revision = required.find((task) =>
    ["REVISION_REQUIRED", "REJECTED"].includes(task.status || ""),
  );
  if (revision)
    return {
      label: "Changes requested",
      title: revision.title,
      description: `Review the feedback and revise your submission for ${current.name}.`,
      tone: "action",
      action: taskAction(revision),
      buttonLabel: "Review feedback",
    };
  const pending = required.find(
    (task) =>
      !task.status ||
      ["NOT_STARTED", "DRAFT", "IN_PROGRESS"].includes(task.status),
  );
  if (pending)
    return {
      label: "Your next step",
      title: `Complete ${pending.title}`,
      description: `Review the instructions and prepare your submission for ${current.name}.`,
      tone: "action",
      action: taskAction(pending),
      buttonLabel: "Open task",
    };
  const awaiting = required.find((task) =>
    ["SUBMITTED", "UNDER_REVIEW", "AWAITING_REVIEW"].includes(
      task.status || "",
    ),
  );
  if (awaiting)
    return {
      label: "Waiting for review",
      title: current.name,
      description:
        "Your required submissions are awaiting review. Check the submission for feedback and decisions.",
      tone: "pending",
      action: taskAction(awaiting),
      buttonLabel: "View submission",
    };
  if (current.completed)
    return {
      label: "Milestone completed",
      title: current.name,
      description:
        "This milestone is complete. Check the timeline for the next available milestone.",
      tone: "success",
      action: { kind: "timeline" },
      buttonLabel: "View all milestones",
    };
  if (required.length && required.every((task) => task.status === "APPROVED"))
    return {
      label: "Waiting for milestone confirmation",
      title: current.name,
      description:
        "Your task decisions are recorded. Check the milestone requirements and any remaining approval checks.",
      tone: "pending",
      action: taskAction(required[0]),
      buttonLabel: "View submission",
    };
  if (required.length)
    return {
      label: "Your next step",
      title: current.name,
      description:
        "Open the requirements to check the latest status before continuing.",
      tone: "neutral",
      action: { kind: "tasks" },
      buttonLabel: "View requirements",
    };
  return {
    label: "Your next step",
    title: current.name,
    description:
      current.requiresDocument === false
        ? "Review the instructions for this milestone and coordinate with the responsible faculty member."
        : "Review the requirements and prepare your submission.",
    tone: "action",
    action: taskAction(
      current.requiresDocument === false ? undefined : current.tasks?.[0],
    ),
    buttonLabel:
      current.requiresDocument === false ? "Open milestone" : "Open task",
  };
}

export function projectSectionHref(section: "overview" | "my-group") {
  return `/student/dashboard?tab=group${section === "my-group" ? "&section=my-group" : ""}`;
}
