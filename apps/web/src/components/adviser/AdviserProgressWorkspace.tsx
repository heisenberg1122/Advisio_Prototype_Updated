import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { EmptyNote } from "@/components/ui/advisio";
import "./progress-workspace.css";

type ProgressTask = {
  id: string;
  title: string;
  stageSequence?: number;
  stageName?: string;
  submission?: {
    status?: string;
    submittedByUser?: { firstName?: string; lastName?: string } | null;
  } | null;
};

export type ProgressGroup = {
  id: string;
  groupName: string;
  projectTitle?: string;
  status: string;
  currentStage: string;
  progress: number;
  members: unknown[];
  leader: string;
  tasks?: ProgressTask[];
};

type TaskState = "done" | "next" | "review" | "changes" | "future";

const readable = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const clamp = (value: number) => Math.min(100, Math.max(0, value));
const isComplete = (group: ProgressGroup) => group.status.toUpperCase() === "COMPLETED" || group.progress >= 100;
const compareNames = (a: ProgressGroup, b: ProgressGroup) =>
  a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: "base" });

/** The first unapproved requirement with nothing submitted is what the group should do next. */
function describeTasks(tasks: ProgressTask[]) {
  let nextAssigned = false;
  return tasks.map((task) => {
    const status = task.submission?.status;
    const person = task.submission?.submittedByUser;
    const submitter = person ? `${person.firstName || ""} ${person.lastName || ""}`.trim() : "";
    let state: TaskState;
    let label: string;
    if (status === "APPROVED") {
      state = "done";
      label = "Approved";
    } else if (status === "REVISION_REQUIRED" || status === "REJECTED") {
      state = "changes";
      label = readable(status);
      nextAssigned = true;
    } else if (status) {
      state = "review";
      label = readable(status);
      nextAssigned = true;
    } else if (!nextAssigned) {
      state = "next";
      label = "Next up";
      nextAssigned = true;
    } else {
      state = "future";
      label = "Not submitted";
    }
    const detail = submitter ? `Submitted by ${submitter}` : task.stageName && task.stageName !== task.title ? task.stageName : "";
    return { task, state, label, detail };
  });
}

export function AdviserProgressWorkspace({
  advisees,
  loading,
  countsLoading = false,
  error,
  onRetry,
  seal,
  onNavigate,
}: {
  advisees: ProgressGroup[];
  loading: boolean;
  countsLoading?: boolean;
  error: boolean;
  onRetry: () => void;
  seal?: string;
  onNavigate: (tab: string) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);

  const groups = [...advisees].sort((a, b) => a.progress - b.progress || compareNames(a, b));
  const selected = groups.find((group) => group.id === pickedId) ?? groups[0];
  const completed = groups.filter(isComplete).length;
  const inProgress = groups.length - completed;
  const average = groups.length ? Math.round(groups.reduce((sum, group) => sum + clamp(group.progress), 0) / groups.length) : 0;
  const furthestBehind = groups.find((group) => !isComplete(group));

  const summary = !groups.length
    ? "Follow each research group’s progress through its requirements."
    : countsLoading
      ? "Checking progress across your research groups…"
      : furthestBehind
        ? `${furthestBehind.groupName} is furthest behind at ${clamp(furthestBehind.progress)}%. Average progress is ${average}%.`
        : `Every research group is complete. Average progress is ${average}%.`;

  const counts = [
    { label: "Groups", value: String(groups.length) },
    { label: "Average", value: countsLoading ? "—" : `${average}%` },
    { label: "In progress", value: countsLoading ? "—" : String(inProgress), waiting: !countsLoading && inProgress > 0 },
    { label: "Completed", value: countsLoading ? "—" : String(completed) },
  ];

  const rows = describeTasks(selected?.tasks ?? []);
  const approved = rows.filter((row) => row.state === "done").length;
  const inReview = rows.filter((row) => row.state === "review" || row.state === "changes").length;
  const notSubmitted = rows.length - approved - inReview;
  const selectedProgress = selected ? clamp(selected.progress) : 0;

  return (
    <div className="adviser-overview mx-auto flex w-full max-w-[1360px] flex-col gap-6">
      <section className="adviser-overview__hero phone-slim-hero" aria-labelledby="adviser-progress-title">
        {seal && <img className="adviser-overview__seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <header className="adviser-overview__hero-heading">
          <div>
            <p className="adviser-overview__eyebrow">Advisee management</p>
            <h1 id="adviser-progress-title" data-guide={!loading && !error && !groups.length ? "adviser-progress-empty" : undefined}>Group progress</h1>
            <p>{summary}</p>
          </div>
          <dl className="adviser-overview__workload ap-counts" aria-label="Progress summary">
            {counts.map((item) => (
              <div key={item.label} className="adviser-overview__workload-item ap-count" data-waiting={item.waiting ? "true" : undefined}>
                <dd className="adviser-overview__metric-value">{error ? "—" : item.value}</dd>
                <dt className="adviser-overview__metric-label">{item.label}</dt>
              </div>
            ))}
          </dl>
        </header>
        <div className="adviser-overview__hero-actions">
          <button type="button" className="adviser-overview__hero-primary" data-phone-label="Advisees" onClick={() => onNavigate("advisees")}>
            <i className="ti ti-users" aria-hidden="true" /> My advisees
          </button>
          <button type="button" className="adviser-overview__hero-secondary" onClick={() => onNavigate("group-chats")}>
            <i className="ti ti-messages" aria-hidden="true" /> Message groups
          </button>
        </div>
      </section>

      {!selected ? (
        <div className="ap-panel">
          {error ? (
            <EmptyNote
              layout="page"
              tone="problem"
              icon="ti-alert-triangle"
              title="We couldn’t load your research groups"
              text="Your connection may have dropped. Try again in a moment."
              action={<button type="button" className="ap-secondary" onClick={onRetry}>Try again</button>}
            />
          ) : (
            <EmptyNote
              layout="page"
              icon="ti-chart-line"
              title={loading ? "Loading your research groups…" : "No research groups to track yet"}
              text={loading ? undefined : "Progress appears here after you accept a group’s adviser request."}
            />
          )}
        </div>
      ) : (
        <>
          <div className="ap-picks" role="group" aria-label="Choose a research group">
            {groups.map((group) => {
              const progress = clamp(group.progress);
              return (
                <button
                  key={group.id}
                  type="button"
                  className="ap-pick"
                  data-guide="adviser-progress-group"
                  aria-pressed={group.id === selected.id}
                  aria-label={`${group.groupName}, ${progress}% complete, ${group.currentStage}`}
                  onClick={() => setPickedId(group.id)}
                >
                  <span className="ap-ring ap-ring--small" data-complete={progress >= 100 ? "true" : undefined} style={{ "--ap-progress": progress } as CSSProperties} aria-hidden="true">
                    <b>{progress}%</b>
                  </span>
                  <span className="ap-pick-text">
                    <strong>{group.groupName}</strong>
                    <small>{group.currentStage}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <section className="ap-panel ap-detail" aria-label={`${selected.groupName} progress`}>
            <div className="ap-summary">
              <div className="ap-summary-top">
                <span
                  className="ap-ring"
                  role="img"
                  aria-label={`${selectedProgress}% complete`}
                  data-complete={selectedProgress >= 100 ? "true" : undefined}
                  style={{ "--ap-progress": selectedProgress } as CSSProperties}
                >
                  <b>{selectedProgress}%</b>
                </span>
                <div>
                  <p className="ap-group-name">{selected.groupName}</p>
                  <p>{selected.members.length} members · lead {selected.leader}</p>
                  <p>Current stage: {selected.currentStage}</p>
                </div>
              </div>
              <h2>{selected.projectTitle || "Research Study"}</h2>
              <div className="ap-actions">
                <Link href={`/adviser/advisees/${selected.id}`} className="ap-primary">
                  <i className="ti ti-folder-open" aria-hidden="true" /> Open workspace
                </Link>
                <button type="button" className="ap-secondary" onClick={() => onNavigate("group-chats")}>
                  <i className="ti ti-messages" aria-hidden="true" /> Message group
                </button>
              </div>
              <dl className="ap-stats">
                <div data-tone="done">
                  <dd>{approved}</dd>
                  <dt>Approved</dt>
                </div>
                <div data-tone="waiting">
                  <dd>{inReview}</dd>
                  <dt>In progress</dt>
                </div>
                <div>
                  <dd>{notSubmitted}</dd>
                  <dt>Not submitted</dt>
                </div>
              </dl>
            </div>

            <div className="ap-timeline">
              <h3 data-guide="adviser-progress-requirements">Requirements</h3>
              {rows.length ? (
                <ol>
                  {rows.map(({ task, state, label, detail }, index) => (
                    <li key={task.id} data-state={state} aria-current={state === "next" ? "step" : undefined}>
                      <span className="ap-dot" aria-hidden="true">
                        {state === "done" ? <i className="ti ti-check" /> : task.stageSequence ?? index + 1}
                      </span>
                      <div className="ap-task">
                        <strong>{task.title}</strong>
                        {detail && <small>{detail}</small>}
                      </div>
                      <span className="ap-status">{label}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyNote layout="row" icon="ti-list-check" title="No requirements set up yet" text="This group’s workflow doesn’t have submission requirements." />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
