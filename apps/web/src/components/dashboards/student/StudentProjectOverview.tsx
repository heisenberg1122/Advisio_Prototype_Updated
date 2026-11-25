import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { ProjectAuditHistory } from "@/components/workflow/ProjectAuditHistory";
import { studentTaskDetailsHref } from "@/lib/student-task-navigation";
import { withProjectContext } from "@/lib/active-project";
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
import { initials, primaryStatus, shortDate } from "@/lib/project-overview-display";
import { isDueSoon } from "@/lib/researcher-home";
import "./project-overview.css";

/** A list row: the title is the link; the single status underneath is read-only text. */
function SummaryRecords({ records, empty, now }: { records: OverviewRecord[]; empty: string; now: number }) {
  if (!records.length) return <p className="mp-note po-empty">{empty}</p>;
  return (
    <ul className="po-rows">
      {records.map(({ id, title, detail, href, date, dateWithTime, urgent }) => {
        const status = primaryStatus(detail);
        return (
          <li key={id}>
            <div className="po-row-body">
              {href ? <Link href={href} className="po-row-title">{title}</Link> : <strong className="po-row-title">{title}</strong>}
              {status && <p className={`po-status ${status.attention ? "po-status--attention" : ""}`}>{status.text}</p>}
            </div>
            {date && <time className={`po-when ${urgent ? "po-when--soon" : ""}`} dateTime={date}>{urgent && "Due "}{shortDate(date, now, dateWithTime)}</time>}
          </li>
        );
      })}
    </ul>
  );
}

export function StudentProjectOverview({
  project, isLeader, workflowName, coordinator, academicYear, milestones, loading, error,
  adviser, adviserName, titleHistory, teamName, groupCode, members, pendingMembers,
  documents, documentsState, academic, activity, onAction, onGroup, onArchive, defenseDecision, adviserRequestPending, logoSrc,
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
  /** The released official defense decision, when one exists. */
  defenseDecision?: string | null;
  adviserRequestPending?: boolean;
  /** The account's college seal, shown faintly in the header. */
  logoSrc?: string;
}) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const now = Date.now();
  const next = resolveProjectNextStep({ project, milestones, loading, error, isLeader, defenseDecision, adviserRequestPending });
  const titleLabel = researchTitleLabel(project);
  const workflowAvailable = Boolean(project.workflowInstance && !project.workflowAccessRemoved);
  const current = currentProjectMilestone(project, milestones);
  const stage = !workflowAvailable ? "Unavailable"
    : project.workflowInstance?.completedAt ? "Workflow completed"
    : current?.name || project.workflowInstance?.currentStage?.name || "No current milestone";
  const pendingTitle = project.titleRevisions?.find((revision) => revision.status === "PENDING");
  const snapshot = workflowAvailable && milestones && !loading && !error ? milestoneSnapshot(project, milestones) : null;
  const totalMilestones = milestones?.length || 0;
  const completedMilestones = project.workflowInstance?.completedAt ? totalMilestones : milestones?.filter(({ completed }) => completed).length || 0;
  const requirements = snapshot ? pendingProjectRequirements(project, milestones).slice(0, 3) : [];
  const projectLink = (path: string) => withProjectContext(path, project.id);
  const action = next.action;
  const abstract = project.abstract?.trim();
  const title = project.title?.trim();
  const statusNeedsAttention = /revision|reject/i.test(project.status || "");
  // The label above the title already names the stage, so don't repeat it.
  const description = next.description.replace(` for ${stage}.`, ".");
  const nextLabel = [next.label, workflowAvailable && !project.workflowInstance?.completedAt && current ? stage : null].filter(Boolean).join(" · ");

  return (
    <div className="student-projects-readable mp-workspace mp-project po-page">
      <section data-tour="researcher-project-summary" className="mp-panel po-cover" aria-label="Project details">
        {logoSrc && <img className="po-cover-seal" src={logoSrc} alt="" aria-hidden="true" draggable={false} />}
        <div className="po-cover-layout">
          <div className="po-cover-copy">
            <p className="po-meta">
              <span>{[workflowAvailable ? workflowName || "Research workflow" : "Workflow unavailable", academicYear && `AY ${academicYear}`, titleLabel].filter(Boolean).join(" · ")}</span>
              {project.status && <span className={`po-badge ${statusNeedsAttention ? "po-badge--attention" : ""}`}>{overviewStatus(project.status)}</span>}
            </p>
            <h1 className={`po-title ${title ? "" : "po-title--empty"}`} data-guide="researcher-project-summary">{title || "Research title not added"}</h1>
            <div className="po-people">
              <div className="po-person">
                <span className="po-stack" aria-hidden="true">
                  {members.slice(0, 3).map((member) => <span key={member.id}>{initials(member.name)}</span>)}
                </span>
                <span><small>{teamName}{groupCode && ` · ${groupCode}`}</small><b>{members.length} {members.length === 1 ? "member" : "members"}</b></span>
              </div>
              <div className="po-person" data-guide="adviser-summary">
                <span className="po-avatar" aria-hidden="true">{adviserName ? initials(adviserName) : "?"}</span>
                <span><small>Adviser</small><b>{adviserName || "Not assigned"}</b></span>
              </div>
              {coordinator && workflowAvailable && (
                <div className="po-person">
                  <span className="po-avatar" aria-hidden="true">{initials(coordinator)}</span>
                  <span><small>Coordinator</small><b>{coordinator}</b></span>
                </div>
              )}
            </div>
            {pendingTitle && <p className="mp-note po-pending-title">Title amendment awaiting review <strong>{pendingTitle.proposedTitle}</strong></p>}
          </div>
          <div className="po-cover-side">
            <div className="po-cover-actions">
              <ProjectAuditHistory key={project.id} researchId={project.id} />
              {isLeader && (
                <button type="button" className="mp-button mp-button--secondary po-icon-button" onClick={() => onAction({ kind: "edit" })} aria-label="Edit project details" title="Edit project details">
                  <Pencil size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
            </div>
            {abstract && (
              <button type="button" className="po-abstract-toggle" aria-expanded={abstractOpen} aria-controls="project-abstract" onClick={() => setAbstractOpen((open) => !open)}>
                {abstractOpen ? "Hide abstract" : "Show abstract"}
                <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {abstract && <p id="project-abstract" className="po-abstract" hidden={!abstractOpen}>{abstract}</p>}
      </section>

      <section className="mp-panel mp-next po-next" aria-labelledby="project-next-step" aria-live="polite">
        <p className="po-eyebrow">{nextLabel}</p>
        <h2 id="project-next-step" className="po-next-title">{next.title}</h2>
        <p className="po-next-description">{description}</p>
        {(action || next.dueAt) && (
          <div className="po-next-foot">
            {action && (
              <button type="button" onClick={() => onAction(action)} className="mp-button mp-button--primary">
                {next.buttonLabel} <span aria-hidden="true">→</span>
              </button>
            )}
            {next.dueAt && <p className="po-due">Due <time dateTime={next.dueAt.toISOString()}>{overviewDate(next.dueAt)}</time></p>}
          </div>
        )}
      </section>

      <section className="mp-panel mp-progress" aria-labelledby="project-workflow-progress">
        <div className="mp-section-heading po-heading">
          <h2 id="project-workflow-progress" className="mp-section-title">Milestones</h2>
          {workflowAvailable && <Link href={projectLink("/student/dashboard?tab=milestones")} className="mp-text-action">View timeline</Link>}
        </div>
        {snapshot ? (
          <>
            {totalMilestones > 0 && (
              <div className="po-progress">
                <progress aria-label="Milestones complete" value={completedMilestones} max={totalMilestones} />
                <span>{completedMilestones} of {totalMilestones} complete</span>
              </div>
            )}
            <ol className="po-milestones">
              {snapshot.stages.map((item) => {
                const state = item.completed ? "done" : item.id === snapshot.activeId ? "current" : "upcoming";
                return (
                  <li key={item.id} className={`po-milestone po-milestone--${state}`} aria-current={state === "current" ? "step" : undefined}>
                    <span className="po-milestone-dot" aria-hidden="true">{state === "done" ? "✓" : item.sequence}</span>
                    <strong>{item.name}</strong>
                    <span>{item.completed ? "Completed" : item.id === snapshot.activeId ? "Current stage" : item.isBlocked ? "Blocked" : item.status && item.status !== "NOT_STARTED" ? overviewStatus(item.status) : "Upcoming"}</span>
                  </li>
                );
              })}
            </ol>
            {!snapshot.stages.length && <p className="mp-note">No milestones configured.</p>}
          </>
        ) : <p className="mp-note">{loading ? "Loading milestone progress…" : error ? "Milestone progress could not be loaded." : "Milestone progress is unavailable."}</p>}
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading po-heading">
          <h2 className="mp-section-title">Pending requirements</h2>
          {workflowAvailable && <Link className="mp-text-action" href={projectLink("/student/tasks")}>All tasks</Link>}
        </div>
        <SummaryRecords
          now={now}
          empty={snapshot ? "No pending requirements for the current stage." : "Current requirements are unavailable."}
          records={requirements.map((task) => ({
            id: task.id,
            title: task.title,
            detail: task.overdue ? "Overdue" : overviewStatus(task.status || "NOT_STARTED"),
            date: task.dueAt?.toISOString(),
            urgent: Boolean(task.overdue || (task.dueAt && isDueSoon(task.dueAt, now))),
            href: studentTaskDetailsHref(task.id, project.id),
          }))}
        />
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading po-heading">
          <h2 className="mp-section-title">Documents & submissions</h2>
          <Link href={projectLink("/student/documents")} className="mp-text-action">All documents</Link>
        </div>
        <SummaryRecords now={now} records={documents} empty={documentsState === "loading" ? "Loading documents…" : documentsState === "error" ? "Documents could not be loaded." : "No project documents yet."} />
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading po-heading">
          <h2 className="mp-section-title">Research group</h2>
          <button type="button" onClick={onGroup} className="mp-text-action">View group</button>
        </div>
        <ul className="po-rows">
          {members.slice(0, 4).map((member) => (
            <li key={member.id} className="po-member">
              <span className="po-avatar po-avatar--muted" aria-hidden="true">{initials(member.name)}</span>
              <span className="po-row-body">{member.name}</span>
              {member.leader && <span className="po-status">Leader</span>}
            </li>
          ))}
        </ul>
        {members.length > 4 && <p className="mp-note">+{members.length - 4} more in the group roster</p>}
        {isLeader && pendingMembers > 0 && <p className="mp-note">{pendingMembers} pending join {pendingMembers === 1 ? "request" : "requests"}</p>}
      </section>

      <section className="mp-panel mp-half">
        <div className="mp-section-heading po-heading">
          <h2 className="mp-section-title">Academic activities</h2>
          <Link href={projectLink("/student/defense")} className="mp-text-action">Defense readiness</Link>
        </div>
        <SummaryRecords now={now} records={academic} empty="No confirmed upcoming consultation, defense, or released outcome for this project." />
      </section>

      <section className="mp-panel">
        <div className="mp-section-heading po-heading">
          <h2 className="mp-section-title">Recent research activity</h2>
          {workflowAvailable && <Link href={projectLink("/student/dashboard?tab=milestones")} className="mp-text-action">Full activity</Link>}
        </div>
        {activity.length ? (
          <ul className="po-rows">
            {activity.slice(0, 3).map(({ id, title, detail, href, date }) => (
              <li key={id}>
                <div className="po-row-body">
                  {href ? <Link href={href} className="po-row-title">{title}</Link> : <strong className="po-row-title">{title}</strong>}
                  {detail && <p className="po-status po-status--clip" title={detail}>{detail}</p>}
                </div>
                {date && <time className="po-when" dateTime={date}>{shortDate(date, now)}</time>}
              </li>
            ))}
          </ul>
        ) : <p className="mp-note po-empty">{loading ? "Loading project activity…" : !workflowAvailable || error ? "Project activity is unavailable." : "No recent research activity recorded."}</p>}
      </section>

      <details className="mp-panel mp-disclosure po-settings">
        <summary className="mp-disclosure-heading">
          Project settings <span className="mp-disclosure-status">Adviser assignment, title history{isLeader ? ", archive" : ""}</span>
        </summary>
        <div className="mp-adviser">{adviser}</div>
        {titleHistory}
        {isLeader ? (
          <button type="button" onClick={onArchive} className="mt-3 min-h-11 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline dark:text-rose-300">Archive project</button>
        ) : <p className="mp-note">Your group leader manages project details. See Group & Members for membership options.</p>}
      </details>
    </div>
  );
}
