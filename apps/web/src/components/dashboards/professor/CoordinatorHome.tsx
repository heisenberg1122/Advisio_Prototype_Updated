import { CardLink, CountStrip, DateTile, EmptyNote, PageBand, StatusDot } from "@/components/ui/advisio";
import { Button } from "@/components/ui/Button";
import { useIsPhone } from "@/hooks/use-is-phone";
import { ProgressRing, progressTone } from "@/components/dashboards/RoleHomeParts";

const REVIEW_STATUSES = ["SUBMITTED", "UNDER_REVIEW"];
const DAY_MS = 86_400_000;

function daysSince(value: string | undefined, now: number) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / DAY_MS));
}

function agoLabel(days: number | null) {
  if (days === null) return null;
  if (days === 0) return "Today";
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function defenseName(type: string) {
  return type.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function sourceLabel(source: string) {
  if (source === "SYSTEM_ADMIN") return "System Admin";
  return source === "DEAN" ? "Dean / Admin" : "Professor";
}

const shortDate = (date: Date) => date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function CoordinatorHome({
  firstName,
  studentsCount,
  projects,
  milestoneCount,
  submissions,
  needsReviewCount,
  defenseEvents,
  defenseUnavailable,
  announcements,
  announcementsLoading,
  announcementsError,
  projectsError,
  workflowsError,
  onOpenTab,
  onReview,
  onRetryAnnouncements,
  onRetryOverview,
}: {
  firstName?: string;
  studentsCount: number;
  projects: any[];
  milestoneCount: number;
  submissions: any[];
  needsReviewCount: number;
  defenseEvents: any[];
  defenseUnavailable: boolean;
  announcements: any[];
  announcementsLoading: boolean;
  announcementsError: boolean;
  projectsError: boolean;
  workflowsError: boolean;
  onOpenTab: (tab: string) => void;
  onReview: (submission: any) => void;
  onRetryAnnouncements: () => void;
  onRetryOverview: () => void;
}) {
  const isPhone = useIsPhone();
  const now = Date.now();
  const queue = submissions
    .filter((item) => REVIEW_STATUSES.includes(item.status))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .slice(0, 4);
  const [lead, ...others] = queue;
  const leadDays = lead ? daysSince(lead.submittedAt, now) : null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = defenseEvents
    .filter((event) => event.status !== "COMPLETED" && new Date(event.scheduledStart) >= startOfToday)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
    .slice(0, 3);

  const groups = [...projects].sort((a, b) => a.progress - b.progress).slice(0, 4);

  const heroStatus = () => {
    if (projectsError) return "Some coordination data couldn’t load";
    const next = upcoming[0] ? ` · next defense ${shortDate(new Date(upcoming[0].scheduledStart))}` : "";
    if (needsReviewCount > 0) return `${needsReviewCount} ${needsReviewCount === 1 ? "submission waits" : "submissions wait"} for your review${next}`;
    if (!projects.length) return `No research groups yet${next}`;
    return `Nothing waiting for review · ${projects.length} ${projects.length === 1 ? "group" : "groups"} in progress${next}`;
  };

  const secondary = [
    { label: "Workflow", icon: "ti-adjustments", tab: "builder" },
    { label: "Defense", icon: "ti-gavel", tab: "defense" },
  ];

  return (
    <div className="rh">
      <PageBand
        variant="home"
        className="role-hero"
        titleId="coordinator-home-title"
        eyebrow="Research coordination"
        title={`Good day, ${firstName?.trim() || "Professor"}`}
        meta={heroStatus()}
        counts={
          <CountStrip
            label="Coordination metrics"
            items={[
              { label: "Students", value: projectsError ? "—" : studentsCount, onClick: () => onOpenTab("monitoring") },
              { label: "Groups", value: projectsError ? "—" : projects.length, onClick: () => onOpenTab("monitoring") },
              { label: "Milestones", value: workflowsError ? "—" : milestoneCount, onClick: () => onOpenTab("builder") },
              { label: "To review", value: projectsError ? "—" : needsReviewCount, tone: needsReviewCount > 0 ? "waiting" : undefined, onClick: () => onOpenTab("submissions") },
            ]}
          />
        }
        actions={
          <>
            {needsReviewCount > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => onOpenTab("submissions")}>
                Review submissions <i className="ti ti-arrow-right ml-1.5" aria-hidden="true" />
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<i className="ti ti-plus" aria-hidden="true" />} onClick={() => onOpenTab("builder")}>
                Create milestone
              </Button>
            )}
            {secondary.map((item) =>
              isPhone ? (
                <Button key={item.tab} size="icon" variant="ghost" className="au-on-home" aria-label={item.label} icon={<i className={`ti ${item.icon}`} aria-hidden="true" />} onClick={() => onOpenTab(item.tab)} />
              ) : (
                <Button key={item.tab} size="sm" variant="ghost" className="au-on-home" icon={<i className={`ti ${item.icon}`} aria-hidden="true" />} onClick={() => onOpenTab(item.tab)}>
                  {item.label}
                </Button>
              ),
            )}
          </>
        }
      />

      {(projectsError || workflowsError) && (
        <div className="rh-notice" role="status">
          <span>Some overview data couldn’t load.</span>
          <button type="button" className="au-link" onClick={onRetryOverview}>Try again</button>
        </div>
      )}

      <div className="rh-grid">
        <section className="rh-panel" aria-labelledby="coordinator-attention-title">
          <div className="rh-head">
            <h2 id="coordinator-attention-title">Review queue</h2>
            {needsReviewCount > 0 && <span className="rh-pill" data-tone="waiting">{needsReviewCount}</span>}
            {needsReviewCount > 0 && <CardLink onClick={() => onOpenTab("submissions")}>View all</CardLink>}
          </div>
          {lead ? (
            <>
              <div className="rh-lead">
                <div className="rh-text">
                  <span className="rh-tag">
                    <i className="ti ti-clock" aria-hidden="true" />{" "}
                    {queue.length > 1 ? "Waiting longest" : "Next to review"}
                    {leadDays ? ` · ${leadDays} ${leadDays === 1 ? "day" : "days"}` : ""}
                  </span>
                  <h3>{lead.task?.title || "Submission"}</h3>
                  <p>{lead.projectTitle}</p>
                </div>
                <button type="button" className="rh-cta" onClick={() => onReview(lead)}>
                  Review <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
              {others.length > 0 && (
                <ul className="rh-rows">
                  {others.map((item) => {
                    const ago = agoLabel(daysSince(item.submittedAt, now));
                    return (
                      <li key={item.id}>
                        <div className="rh-row">
                          <span className="rh-icon" aria-hidden="true"><i className="ti ti-file-text" /></span>
                          <div className="rh-text">
                            <h3>{item.task?.title || "Submission"}</h3>
                            <p>{item.projectTitle}{ago ? ` · ${ago}` : ""}</p>
                          </div>
                          <button type="button" className="rh-secondary" aria-label={`Review ${item.task?.title || "submission"}`} onClick={() => onReview(item)}>Review</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="rh-space">
              <EmptyNote
                layout="row"
                tone={projectsError ? "problem" : "ok"}
                icon={projectsError ? "ti-alert-circle" : "ti-circle-check"}
                title={projectsError ? "Submissions couldn’t load" : "You’re caught up on reviews"}
                text={projectsError ? undefined : "New student submissions will appear here, oldest first."}
              />
            </div>
          )}
        </section>

        <section className="rh-panel" aria-labelledby="coordinator-defenses-title">
          <div className="rh-head">
            <h2 id="coordinator-defenses-title">Upcoming defenses</h2>
            {upcoming.length > 0 && <CardLink onClick={() => onOpenTab("defense")}>Defense</CardLink>}
          </div>
          {upcoming.length ? (
            <ul className="rh-rows">
              {upcoming.map((event) => {
                const start = new Date(event.scheduledStart);
                const count = event.sessions?.length ?? 0;
                const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                return (
                  <li key={event.id}>
                    <button type="button" className="rh-row" onClick={() => onOpenTab("defense")}>
                      <DateTile top={start.toLocaleDateString(undefined, { month: "short" })} bottom={start.getDate()} tone={event.status === "ONGOING" ? "live" : undefined} />
                      <span className="rh-text">
                        <span className="rh-title">{defenseName(event.defenseType)}</span>
                        <span className="rh-meta">{[time, event.venue, `${count} ${count === 1 ? "group" : "groups"}`].filter(Boolean).join(" · ")}</span>
                        <StatusDot tone={event.status === "READY" ? "done" : event.status === "ONGOING" ? "live" : "neutral"}>
                          {defenseName(event.status)}
                        </StatusDot>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rh-space">
              <EmptyNote
                layout="row"
                tone={defenseUnavailable ? "problem" : undefined}
                icon={defenseUnavailable ? "ti-alert-circle" : "ti-gavel"}
                title={defenseUnavailable ? "Defenses couldn’t load" : "No defense scheduled"}
                text={defenseUnavailable ? undefined : "Schedule one when groups clear their requirements."}
                action={defenseUnavailable ? undefined : <button type="button" className="rh-secondary" onClick={() => onOpenTab("defense")}><i className="ti ti-plus" aria-hidden="true" />Schedule defense</button>}
              />
            </div>
          )}
        </section>
      </div>

      <section className="rh-panel" aria-labelledby="coordinator-monitoring-title">
        <div className="rh-head">
          <h2 id="coordinator-monitoring-title">Group progress</h2>
          {projects.length > 0 && <span className="rh-pill">{projects.length}</span>}
          {projects.length > 0 && <CardLink onClick={() => onOpenTab("tracking")}>View all</CardLink>}
        </div>
        {groups.length ? (
          <>
            <p className="rh-lede">Furthest behind come first, so you can step in early.</p>
            <div className="rh-groups">
              {groups.map((project) => (
                <button key={project.id} type="button" className="rh-group" aria-label={`${project.group}, ${project.progress}% complete`} onClick={() => onOpenTab("tracking")}>
                  <ProgressRing value={project.progress} tone={progressTone(project.progress)} />
                  <span className="rh-group-text">
                    <strong>{project.group}</strong>
                    <small>{project.currentStage?.name || "Not started"}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rh-space">
            <EmptyNote
              layout="row"
              tone={projectsError ? "problem" : undefined}
              icon={projectsError ? "ti-alert-circle" : "ti-users-group"}
              title={projectsError ? "Research groups couldn’t load" : "No active groups yet"}
              text={projectsError ? undefined : "Research groups will appear here once registered."}
            />
          </div>
        )}
      </section>

      <section className="rh-panel" aria-labelledby="coordinator-updates-title">
        <div className="rh-head">
          <h2 id="coordinator-updates-title">College and system updates</h2>
          <CardLink onClick={() => onOpenTab("announcements")}>View all</CardLink>
        </div>
        {announcements.length ? (
          <div className="rh-news">
            {announcements.slice(0, 3).map((announcement) => (
              <article key={announcement.id} className="rh-news-item">
                <div className="rh-news-source">
                  <i data-source={announcement.source} aria-hidden="true" />
                  <span>{sourceLabel(announcement.source)}</span>
                </div>
                <h3>{announcement.title}</h3>
                <p className="line-clamp-2">{announcement.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rh-space">
            <EmptyNote
              layout="row"
              tone={announcementsError ? "problem" : undefined}
              icon={announcementsError ? "ti-alert-circle" : "ti-speakerphone"}
              title={announcementsError ? "Updates couldn’t load" : announcementsLoading ? "Loading updates…" : "No current announcements"}
              action={announcementsError ? <button type="button" className="au-link" onClick={onRetryAnnouncements}>Try again</button> : undefined}
            />
          </div>
        )}
      </section>
    </div>
  );
}
