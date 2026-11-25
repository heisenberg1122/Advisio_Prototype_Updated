import { resolveWorkflowDeadline, WORKFLOW_TIME_ZONE } from "./workflow-deadlines";
import { taskDocumentsHref } from "./document-task-navigation";
import { withProjectContext } from "./active-project";

export interface ProjectTaskProgress {
  id: string;
  title: string;
  isRequired?: boolean;
  status?: string | null;
  submissionId?: string | null;
  reviewers?: string[];
}

export interface ProjectMilestoneProgress {
  id: string;
  name: string;
  sequence: number;
  isCurrent?: boolean;
  completed?: boolean;
  status?: string | null;
  requiresDocument?: boolean;
  milestoneType?: string;
  totalRequirements?: number;
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
  abstract?: string | null;
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
    startedAt?: string | null;
    transitions?: Array<{ toStageId: string; createdAt: string }>;
    currentStage?: { id: string; name: string } | null;
    workflow?: { name?: string; stages?: OverviewWorkflowStage[] } | null;
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
  dueAt?: Date | null;
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
  defenseDecision,
  adviserRequestPending,
}: {
  project: OverviewProject;
  milestones?: ProjectMilestoneProgress[];
  loading?: boolean;
  error?: boolean;
  isLeader: boolean;
  /** The released official defense decision, when one exists. */
  defenseDecision?: string | null;
  adviserRequestPending?: boolean;
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
  if (project.workflowInstance.completedAt && defenseDecision === "APPROVED")
    return {
      label: "Research complete",
      title: "Your research is complete",
      description:
        "Your defense was approved. Your official result is on the Defense page.",
      tone: "success",
      action: { kind: "defense" },
      buttonLabel: "View defense result",
    };
  if (project.workflowInstance.completedAt && defenseDecision === "APPROVED_WITH_MINOR_REVISIONS")
    return {
      label: "Defense approved",
      title: "Finish your minor revisions",
      description:
        "Your defense was approved with minor revisions. Check the panel’s recommendations on the Defense page.",
      tone: "action",
      action: { kind: "defense" },
      buttonLabel: "View recommendations",
    };
  if (project.workflowInstance.completedAt && defenseDecision)
    return {
      label: "Defense result released",
      title: "Review your defense result",
      description:
        "Check the panel’s decision and what to do next on the Defense page.",
      tone: "action",
      action: { kind: "defense" },
      buttonLabel: "View defense result",
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
  const current = currentProjectMilestone(project, milestones);
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
  const required = pendingProjectRequirements(project, [current]).filter((task) => !task.milestoneOnly);
  const taskAction = (task?: ProjectTaskProgress): ProjectAction => ({
    kind: "task",
    taskId: task?.id || `milestone-${current.id}`,
  });
  const milestoneDue = requirementDeadline(project, current.id);
  if (!current.completed && current.milestoneType === "ADVISER_SELECTION")
    return {
      label: adviserRequestPending ? "Waiting for adviser acceptance" : "Adviser selection",
      title: current.name,
      description: adviserRequestPending ? "The requested adviser needs to respond." :
        isLeader ? "Choose an adviser and send a request for your group." : "Your group leader needs to request an adviser.",
      tone: adviserRequestPending ? "pending" : "action",
      action: taskAction(),
      buttonLabel: adviserRequestPending ? "View adviser request" : "Open adviser selection",
    };
  if (!current.completed && current.milestoneType === "TITLE_PROPOSAL") {
    const waiting = ["AWAITING_REVIEW", "SUBMITTED", "UNDER_REVIEW", "PENDING"].includes(current.status || "");
    const needsRevision = ["REVISION_REQUIRED", "REJECTED", "CHANGES_REQUESTED"].includes(current.status || "");
    return {
      label: waiting ? "Waiting for title approval" : needsRevision ? "Title revisions requested" : "Title proposal",
      title: current.name,
      description: waiting ? "Your professor or coordinator reviews the proposed titles." :
        needsRevision ? "Open the title proposal to see the feedback and what needs to change." :
          isLeader ? "Prepare and submit your group’s proposed titles." : "Your group leader submits the proposed titles.",
      tone: waiting ? "pending" : "action",
      action: taskAction(),
      buttonLabel: "Open title proposal",
    };
  }
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
      dueAt: revision.dueAt,
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
      dueAt: pending.dueAt,
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
  if (current.tasks?.some((task) => task.isRequired !== false && task.status === "APPROVED") && !required.length)
    return {
      label: "Waiting for milestone confirmation",
      title: current.name,
      description:
        "Your task decisions are recorded. Check the milestone requirements and any remaining approval checks.",
      tone: "pending",
      action: taskAction(current.tasks?.find((task) => task.isRequired !== false && task.status === "APPROVED")),
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
  const milestoneOnly = current.requiresDocument === false || ["TITLE_PROPOSAL", "ADVISER_SELECTION"].includes(current.milestoneType || "");
  if (milestoneOnly && ["AWAITING_REVIEW", "SUBMITTED", "UNDER_REVIEW", "PENDING"].includes(current.status || "")) {
    return {
      label: "Waiting for review",
      title: current.name,
      description: "Open the milestone to check the latest decision.",
      tone: "pending",
      action: taskAction(),
      buttonLabel: "View milestone",
    };
  }
  return {
    label: "Your next step",
    title: current.name,
    description:
      milestoneOnly === false
        ? "Review the instructions for this milestone and coordinate with the responsible faculty member."
        : "Review the requirements and prepare your submission.",
    tone: "action",
    action: taskAction(milestoneOnly ? undefined : current.tasks?.[0]),
    buttonLabel: milestoneOnly || !current.tasks?.length ? "Open milestone" : "Open task",
    dueAt: milestoneDue,
  };
}

export function projectSectionHref(section: "overview" | "my-group") {
  return `/student/dashboard?tab=group${section === "my-group" ? "&section=my-group" : ""}`;
}

interface OverviewWorkflowStage {
  id: string;
  sequence: number;
  targetCompletionDate?: string | null;
  deadlineDays?: number | null;
  tasks?: Array<{ id: string; dueDays?: number | null }>;
}

export interface ProjectActivity {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  documentId?: string | null;
  versionId?: string | null;
  defenseSessionId?: string | null;
  consultationId?: string | null;
  milestoneId?: string | null;
}

export interface OverviewDocumentVersion {
  id: string;
  uploadedAt: string;
  submittedAt?: string | null;
  manuscriptStatus?: string | null;
}

export interface OverviewDocument {
  id: string;
  title: string;
  updatedAt?: string;
  lifecycleStatus?: string | null;
  versions?: OverviewDocumentVersion[];
}

export interface OverviewRecord {
  id: string;
  title: string;
  detail?: string;
  href?: string;
  date?: string;
  /** Show the time as well as the date, for scheduled sessions. */
  dateWithTime?: boolean;
  /** Highlight the date, for deadlines that are overdue or within a week. */
  urgent?: boolean;
}

const revisionStatuses = ["REVISION_REQUIRED", "REJECTED", "NEEDS_REVISION"];

function requirementDeadline(project: OverviewProject, stageId: string, taskId?: string) {
  const workflow = project.workflowInstance;
  const stages = [...(workflow?.workflow?.stages || [])].sort((a, b) => a.sequence - b.sequence);
  const stageIndex = stages.findIndex(({ id }) => id === stageId);
  if (stageIndex < 0) return null;
  const { dueAt, projected } = resolveWorkflowDeadline({
    stages,
    stageIndex,
    startedAt: workflow?.startedAt,
    transitions: workflow?.transitions,
    dueDays: stages[stageIndex].tasks?.find(({ id }) => id === taskId)?.dueDays,
  });
  return !projected && dueAt && Number.isFinite(dueAt.getTime()) ? dueAt : null;
}

export function currentProjectMilestone(project: OverviewProject, milestones?: ProjectMilestoneProgress[]) {
  return milestones?.find(({ isCurrent }) => isCurrent)
    || milestones?.find(({ id }) => id === project.workflowInstance?.currentStage?.id);
}

export function pendingProjectRequirements(
  project: OverviewProject,
  milestones: ProjectMilestoneProgress[] = [],
  now = Date.now(),
) {
  const current = currentProjectMilestone(project, milestones);
  if (!current || current.isBlocked || current.completed || project.workflowAccessRemoved || project.workflowInstance?.completedAt) return [];
  const milestoneOnly = current.requiresDocument === false || ["TITLE_PROPOSAL", "ADVISER_SELECTION"].includes(current.milestoneType || "") || !current.tasks?.length;
  const tasks: ProjectTaskProgress[] = milestoneOnly
    ? [{ id: `milestone-${current.id}`, title: current.name, status: current.status }]
    : (current.tasks || []).filter(({ isRequired, status }) => isRequired !== false && status !== "APPROVED");
  return tasks.map((task) => {
    const dueAt = requirementDeadline(project, current.id, task.id);
    const awaitingReview = ["SUBMITTED", "UNDER_REVIEW", "AWAITING_REVIEW", "PENDING", "APPROVED"].includes(task.status || "");
    const overdue = Boolean(dueAt && dueAt.getTime() < now && !awaitingReview);
    const priority = overdue ? 0 : revisionStatuses.includes(task.status || "") ? 1 : awaitingReview ? 3 : 2;
    return { ...task, dueAt, overdue, priority, milestoneOnly };
  }).sort((a, b) =>
    a.priority - b.priority || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || 0,
  );
}

export function milestoneSnapshot(project: OverviewProject, milestones: ProjectMilestoneProgress[]) {
  const current = currentProjectMilestone(project, milestones);
  const ordered = [...milestones].sort((a, b) => a.sequence - b.sequence);
  const completed = ordered.filter(({ completed }) => completed);
  const active = project.workflowInstance?.completedAt || current?.completed ? undefined : current;
  const remaining = ordered.filter((stage) => !stage.completed && stage.id !== active?.id);
  const stages = [...completed.slice(-1), ...(active ? [active] : []), ...remaining.slice(0, 2)];
  return { completed: completed.length, active: active ? 1 : 0, pending: remaining.length, stages, activeId: active?.id };
}

export function projectActivityHref(event: ProjectActivity, projectId: string): string {
  if (event.documentId) return taskDocumentsHref("student", projectId, event.documentId, event.versionId);
  if (event.defenseSessionId) return withProjectContext(`/student/defense/${encodeURIComponent(event.defenseSessionId)}`, projectId);
  if (event.consultationId) return projectConsultationHref(projectId, event.consultationId);
  if (event.milestoneId) return withProjectContext(`/student/documents?tab=milestones&milestoneId=${encodeURIComponent(event.milestoneId)}`, projectId);
  return withProjectContext("/student/dashboard?tab=milestones", projectId);
}

export function projectConsultationHref(projectId: string, consultationId: string) {
  return withProjectContext(`/student/dashboard?tab=consultations&consultationId=${encodeURIComponent(consultationId)}`, projectId);
}

export function overviewDate(value: string | Date, withTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: WORKFLOW_TIME_ZONE,
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function overviewStatus(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function summarizeProjectDocuments(documents: OverviewDocument[], projectId: string): OverviewRecord[] {
  // The endpoint orders documents by updatedAt and versions by version number.
  const latest = documents[0];
  const submitted = documents.flatMap((document) => (document.versions || [])
    .filter((version) => version.submittedAt)
    .map((version) => ({ document, version })))
    .sort((a, b) => Date.parse(b.version.submittedAt!) - Date.parse(a.version.submittedAt!))[0];

  const reviewStatus = (document: OverviewDocument) =>
    document.lifecycleStatus || document.versions?.[0]?.manuscriptStatus || "";
  const needsRevision = (document: OverviewDocument) => revisionStatuses.includes(reviewStatus(document));
  const awaitingFeedback = (document: OverviewDocument) => ["SUBMITTED", "IN_REVIEW"].includes(reviewStatus(document));
  const reviewLabel = (document: OverviewDocument) => needsRevision(document) ? "Revision requested"
    : awaitingFeedback(document) ? "Awaiting feedback" : undefined;
  const sameAsSubmission = (document: OverviewDocument) =>
    submitted?.document.id === document.id && submitted.version.id === document.versions?.[0]?.id;
  const otherDocuments = documents.filter((document) => document.id !== latest?.id && !sameAsSubmission(document));
  const reviews = [
    ...otherDocuments.filter(needsRevision).slice(0, 2),
    ...otherDocuments.filter(awaitingFeedback).slice(0, 1),
  ];

  return [
    ...(latest && !sameAsSubmission(latest) ? [{
      id: "updated",
      title: latest.title,
      detail: ["Recently updated", reviewLabel(latest)].filter(Boolean).join(" · "),
      date: latest.updatedAt,
      href: taskDocumentsHref("student", projectId, latest.id, reviewLabel(latest) ? latest.versions?.[0]?.id : undefined),
    }] : []),
    ...(submitted ? [{
      id: "submitted",
      title: submitted.document.title,
      detail: [
        ...(latest && sameAsSubmission(latest) ? ["Recently updated"] : []),
        "Latest submission",
        overviewStatus(submitted.version.manuscriptStatus || "SUBMITTED"),
      ].join(" · "),
      date: submitted.version.submittedAt!,
      href: taskDocumentsHref("student", projectId, submitted.document.id, submitted.version.id),
    }] : []),
    ...reviews.map((document) => ({
      id: `review-${document.id}`,
      title: document.title,
      detail: reviewLabel(document),
      href: taskDocumentsHref("student", projectId, document.id, document.versions?.[0]?.id),
    })),
  ];
}
