import React from "react";
import Link from "next/link";
import { ProjectAuditHistory } from "@/components/workflow/ProjectAuditHistory";
import { studentTaskDetailsHref } from "@/lib/student-task-navigation";
import { withProjectContext } from "@/lib/active-project";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import {
  currentProjectMilestone,
  milestoneSnapshot,
  overviewDate,
  overviewStatus,
  pendingProjectRequirements,
  researchTitleLabel,
  resolveProjectNextStep,
  type OverviewProject,
  type OverviewRecord,
  type ProjectAction,
  type ProjectMilestoneProgress,
} from "@/lib/student-project-overview";

function SummaryRecords({ records, empty }: { records: OverviewRecord[]; empty: string }) {
  if (!records.length) return <p className="mp-note">{empty}</p>;
  return (
    <ul className="mp-records">
      {records.map(({ id, title, detail, href, date }) => (
        <li key={id}>
          {href ? <Link href={href}>{title}</Link> : <strong>{title}</strong>}
          {(detail || date) && (
            <p className="mp-note">
              {detail}{detail && date ? " · " : ""}
              {date && <time dateTime={date}>{overviewDate(date)}</time>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function StudentProjectOverview({
  project, isLeader, workflowName, coordinator, academicYear, milestones, loading, error,
  adviser, adviserName, titleHistory, teamName, groupCode, members, pendingMembers,
  documents, documentsState, academic, activity, onAction, onGroup, onArchive,
}: {
  project: OverviewProject;
  isLeader: boolean;
  workflowName?: string;
  coordinator?: string;
  academicYear?: string;
  milestones?: ProjectMilestoneProgress[];
  loading: boolean;
  error: boolean;
  adviser: React.ReactNode;
  adviserName?: string;
  titleHistory?: React.ReactNode;
  teamName: string;
  groupCode?: string;
  members: Array<{ id: string; name: string; leader: boolean }>;
  pendingMembers: number;
  documents: OverviewRecord[];
  documentsState: "loading" | "error" | "ready";
  academic: OverviewRecord[];
  activity: OverviewRecord[];
  onAction: (action: ProjectAction) => void;
  onGroup: () => void;
  onArchive: () => void;
}) {
  const next = resolveProjectNextStep({ project, milestones, loading, error, isLeader });
  const titleLabel = researchTitleLabel(project);
  const workflowAvailable = Boolean(project.workflowInstance && !project.workflowAccessRemoved);
  const current = currentProjectMilestone(project, milestones);
  const stage = !workflowAvailable ? "Unavailable"
    : project.workflowInstance?.completedAt ? "Workflow completed"
    : current?.name || project.workflowInstance?.currentStage?.name || "No current milestone";
  const pendingTitle = project.titleRevisions?.find((revision) => revision.status === "PENDING");
  const snapshot = workflowAvailable && milestones && !loading && !error ? milestoneSnapshot(project, milestones) : null;
  const showProgress = Boolean(project.workflowInstance?.completedAt || milestones?.some(({ totalRequirements }) => (totalRequirements || 0) > 0));
  const progress = calculateMilestoneProgress(milestones, Boolean(project.workflowInstance?.completedAt));
  const requirements = snapshot ? pendingProjectRequirements(project, milestones).slice(0, 3) : [];
  const projectLink = (path: string) => withProjectContext(path, project.id);
  const action = next.action;

  return (
    <div className="student-projects-readable mp-workspace mp-project">
      <section className="mp-panel mp-identity" aria-label="Project details">
        <div className="mp-identity-layout">
          <div className="mp-identity-copy">
            <div className="mp-identity-metadata">
              <p className="mp-workflow-meta">{workflowAvailable ? workflowName || "Research workflow" : "Workflow unavailable"}{academicYear && ` · AY ${academicYear}`}</p>
              {project.status && <span className="mp-status bg-[var(--color-surface-muted)]">{overviewStatus(project.status)}</span>}
            </div>
            <h1 className="mp-project-title">{project.title?.trim() || "Research title not added"}</h1>
            <p className="mp-note">{titleLabel}</p>
            {project.abstract?.trim() && <p className="mp-project-description">{project.abstract}</p>}
            <dl className="mp-project-context">
              <div><dt>Group</dt><dd>{teamName}{groupCode && ` · ${groupCode}`}</dd></div>
              <div><dt>Assigned adviser</dt><dd>{adviserName || "Not assigned"}</dd></div>
              {coordinator && workflowAvailable && <div><dt>Coordinator</dt><dd>{coordinator}</dd></div>}
            </dl>
            {pendingTitle && <p className="mp-note">Title amendment awaiting review <strong>{pendingTitle.proposedTitle}</strong></p>}
          </div>
          <div className="mp-identity-actions">
            <ProjectAuditHistory key={project.id} researchId={project.id} />
            {isLeader && <button type="button" className="mp-button mp-button--secondary" onClick={() => onAction({ kind: "edit" })}>Edit details</button>}
          </div>
        </div>
      </section>

      <section className="mp-panel mp-next" aria-labelledby="project-next-step" aria-live="polite">
        <p className="mp-eyebrow">Current stage</p>
        <p className="mp-stage-name">{stage}</p>
        <p className="mp-eyebrow mp-next-label">{next.label}</p>
        <h2 id="project-next-step" className="mp-next-title">{next.title}</h2>
        <p className="mp-next-description">{next.description}</p>
        {next.dueAt && <p className="mp-note">Due <time dateTime={next.dueAt.toISOString()}>{overviewDate(next.dueAt)}</time></p>}
        {action && (
          <button type="button" onClick={() => onAction(action)} className="mp-button mp-button--primary mp-next-action">
            {next.buttonLabel} <span aria-hidden="true">→</span>
          </button>
        )}
      </section>

      <section className="mp-panel mp-progress" aria-labelledby="project-workflow-progress">
        <div className="mp-section-heading">
          <h2 id="project-workflow-progress" className="mp-section-title">Milestones</h2>
          {workflowAvailable && <Link href={projectLink("/student/dashboard?tab=milestones")} className="mp-text-action">View timeline</Link>}
        </div>
        {snapshot ? (
          <>
            <p className="mp-note">{snapshot.completed} completed · {snapshot.active} active · {snapshot.pending} pending</p>
            {showProgress && (
              <div className="mp-progress-summary">
                <progress aria-label="Workflow requirements completed" value={progress} max={100} />
                <span>{progress}% of requirements completed</span>
              </div>
            )}
            <ol className="mp-milestones">
              {snapshot.stages.map((item) => (
                <li key={item.id} aria-current={item.id === snapshot.activeId ? "step" : undefined}>
                  <strong>{item.name}</strong>
                  <span>{item.completed ? "Completed" : item.id === snapshot.activeId ? "Current stage" : item.isBlocked ? "Blocked" : item.status && item.status !== "NOT_STARTED" ? overviewStatus(item.status) : "Upcoming"}</span>
                </li>
              ))}
            </ol>
            {!snapshot.stages.length && <p className="mp-note">No milestones configured.</p>}
          </>
        ) : <p className="mp-note">{loading ? "Loading milestone progress…" : error ? "Milestone progress could not be loaded." : "Milestone progress is unavailable."}</p>}
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading">
          <h2 className="mp-section-title">Pending requirements</h2>
          {workflowAvailable && <Link className="mp-text-action" href={projectLink("/student/tasks")}>All tasks</Link>}
        </div>
        <SummaryRecords
          empty={snapshot ? "No pending requirements for the current stage." : "Current requirements are unavailable."}
          records={requirements.map((task) => ({
            id: task.id,
            title: task.title,
            detail: `${task.overdue ? "Overdue · " : task.dueAt ? "Due · " : ""}${overviewStatus(task.status || "NOT_STARTED")}`,
            date: task.dueAt?.toISOString(),
            href: studentTaskDetailsHref(task.id, project.id),
          }))}
        />
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading">
          <h2 className="mp-section-title">Documents & submissions</h2>
          <Link href={projectLink("/student/documents")} className="mp-text-action">All documents</Link>
        </div>
        <SummaryRecords records={documents} empty={documentsState === "loading" ? "Loading documents…" : documentsState === "error" ? "Documents could not be loaded." : "No project documents yet."} />
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading">
          <h2 className="mp-section-title">Research group</h2>
          <button type="button" onClick={onGroup} className="mp-text-action">View group</button>
        </div>
        <p className="mp-note">{teamName} · {members.length} {members.length === 1 ? "member" : "members"}</p>
        <ul className="mp-records">
          {members.slice(0, 4).map((member) => <li key={member.id}>{member.name}{member.leader && <span className="mp-note"> · Leader</span>}</li>)}
        </ul>
        {members.length > 4 && <p className="mp-note">+{members.length - 4} more in the group roster</p>}
        {isLeader && pendingMembers > 0 && <p className="mp-note">{pendingMembers} pending join {pendingMembers === 1 ? "request" : "requests"}</p>}
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading">
          <h2 className="mp-section-title">Academic activities</h2>
          <Link href={projectLink("/student/defense")} className="mp-text-action">Defense readiness</Link>
        </div>
        <SummaryRecords records={academic} empty="No confirmed upcoming consultation, defense, or released outcome for this project." />
      </section>

      <section className="mp-panel">
        <div className="mp-section-heading">
          <h2 className="mp-section-title">Recent research activity</h2>
          {workflowAvailable && <Link href={projectLink("/student/dashboard?tab=milestones")} className="mp-text-action">Full activity</Link>}
        </div>
        <SummaryRecords records={activity} empty={loading ? "Loading project activity…" : !workflowAvailable || error ? "Project activity is unavailable." : "No recent research activity recorded."} />
      </section>

      <details className="mp-panel mp-disclosure">
        <summary className="mp-disclosure-heading">Adviser assignment</summary>
        <div className="mp-adviser">{adviser}</div>
      </details>

      <details className="mp-panel mp-disclosure">
        <summary className="mp-disclosure-heading">Project management</summary>
        {titleHistory}
        {isLeader ? (
          <button type="button" onClick={onArchive} className="mt-3 min-h-11 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline dark:text-rose-300">Archive project</button>
        ) : <p className="mp-note">Your group leader manages project details. See Group & Members for membership options.</p>}
      </details>
    </div>
  );
}
