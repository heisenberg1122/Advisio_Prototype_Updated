import { useEffect, useState, type CSSProperties } from "react";
import { EmptyNote, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { MiniProgress, ProgressRing, progressTone, type ProgressTone } from "@/components/dashboards/RoleHomeParts";
import { FilterChips, RoleBand, SearchField, ViewSwitch, initials, plural, useScreenView } from "@/components/dashboards/RoleScreenParts";
import { formatMilestoneTarget } from "@/lib/workflow-deadlines";

const statusLabel = (status: string) => (status === "revision" ? "Revision" : status === "completed" ? "Completed" : "In progress");
const statusTone = (status: string): StatusTone => (status === "revision" ? "waiting" : status === "completed" ? "done" : "brand");
const toneForBand = (tone: StatusTone) => (tone === "brand" ? undefined : tone);
const adviserName = (project: any) => (project.adviser ? `${project.adviser.firstName} ${project.adviser.lastName}` : null);
const researcherText = (project: any) => (project.researchers.length === 1 ? "Individual" : `${project.researchers.length} researchers`);

function NoMatch({ title, text }: { title: string; text: string }) {
  return (
    <div className="rs-empty-card">
      <EmptyNote layout="row" icon="ti-search" title={title} text={text} />
    </div>
  );
}

export function CoordinatorProjects({
  projects,
  search,
  setSearch,
  loading,
  errored,
  skeleton,
  onboarding,
  hasDraftOnly,
  canManageParticipants,
  onManageParticipants,
  onOpen,
  onRemove,
}: {
  projects: any[];
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  errored: boolean;
  skeleton: React.ReactNode;
  onboarding: React.ReactNode;
  hasDraftOnly: boolean;
  canManageParticipants: boolean;
  onManageParticipants: () => void;
  onOpen: (project: any) => void;
  onRemove: (project: any) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "revision" | "completed">("all");
  const [view, setView] = useScreenView("advisio:coordinator-projects-view");
  const kind = (project: any) => (project.status === "revision" || project.status === "completed" ? project.status : "active");
  const count = (value: string) => projects.filter((project) => kind(project) === value).length;
  const query = search.trim().toLowerCase();
  const rows = projects.filter((project) => {
    if (filter !== "all" && kind(project) !== filter) return false;
    if (!query) return true;
    return [project.title, project.adviser?.firstName, project.adviser?.lastName, project.adviser?.email, project.researchType?.name, project.program?.code, project.program?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const removeButton = (project: any) => (
    <button
      type="button"
      className="rs-icon-btn"
      data-tone="danger"
      aria-label={`Remove ${project.group}`}
      onClick={(event) => {
        event.stopPropagation();
        onRemove(project);
      }}
    >
      <i className="ti ti-trash" aria-hidden="true" />
    </button>
  );
  return (
    <div className="rs coordinator-projects">
      <RoleBand
        eyebrow="Course workspace"
        title="Research projects"
        titleId="coordinator-projects-title"
        meta={projects.length ? `${plural(projects.length, "group", "groups")} across your workflows · ${plural(count("revision"), "group is", "groups are")} in revision` : "Manage registered projects across your workflows."}
        counts={[
          { label: "Groups", value: projects.length },
          { label: "Researchers", value: projects.reduce((total, project) => total + project.researchers.length, 0) },
          { label: "In revision", value: count("revision"), tone: count("revision") ? "waiting" : undefined },
          { label: "Completed", value: count("completed") },
        ]}
        countsLabel="Research project summary"
        primary={canManageParticipants ? { label: "Manage participants", phoneLabel: "Manage", icon: "ti-users-plus", onClick: onManageParticipants } : undefined}
      />
      {errored && (
        <div className="rs-empty-card" role="alert">
          <EmptyNote layout="row" tone="problem" icon="ti-alert-circle" title="Dashboard data could not be loaded" text="Check the API connection and try again." />
        </div>
      )}
      {projects.length > 0 && (
        <div className="rs-tools">
          <FilterChips
            label="Filter research projects"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: projects.length },
              { value: "active", label: "In progress", count: count("active") },
              { value: "revision", label: "Revision", count: count("revision") },
              { value: "completed", label: "Completed", count: count("completed") },
            ]}
          />
          <div className="rs-tools-end">
            <SearchField value={search} onChange={setSearch} placeholder="Search project, adviser or program" guide="co-project-search" />
            <ViewSwitch value={view} onChange={setView} />
          </div>
        </div>
      )}
      {loading ? (
        skeleton
      ) : !projects.length ? (
        hasDraftOnly ? (
          <NoMatch title="No registered projects yet" text="Projects still in a draft workflow appear here once they are registered." />
        ) : (
          onboarding
        )
      ) : !rows.length ? (
        <NoMatch title="No projects match" text="Try another filter or search." />
      ) : view === "cards" ? (
        <div className="rs-tiles">
          {rows.map((project) => {
            const tone = statusTone(project.status);
            return (
              <article key={project.id} className="rs-tile" data-clickable="true">
                <div className="rs-tile-band" data-tone={toneForBand(tone)}>
                  <span>{[project.researchType?.name, project.program?.code].filter(Boolean).join(" · ") || "Research project"}</span>
                  <span>{statusLabel(project.status)}</span>
                </div>
                <div className="rs-tile-body">
                  <button type="button" style={{ textAlign: "left" }} onClick={() => onOpen(project)}>
                    <span className="rs-tile-title">{project.group}</span>
                    <span className="rs-tile-meta">{researcherText(project)} · {adviserName(project) ? `Adviser: ${adviserName(project)}` : "No adviser"}</span>
                  </button>
                  <div className="rs-tile-foot">
                    <ProgressRing value={project.progress} tone={progressTone(project.progress)} />
                    <span className="rs-text"><small>Current milestone</small><strong>{project.currentStage?.name || "Not started"}</strong></span>
                    {removeButton(project)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rs-table" style={{ "--rs-cols": "minmax(0,2.4fr) minmax(0,1fr) 130px 104px 36px" } as CSSProperties}>
          <div className="rs-row rs-row--head"><span>Research project</span><span>Milestone</span><span>Progress</span><span>Status</span><span /></div>
          {rows.map((project) => (
            <div key={project.id} className="rs-row rs-row--hover">
              <button type="button" className="rs-who" style={{ textAlign: "left" }} onClick={() => onOpen(project)}>
                <span className="rh-icon" aria-hidden="true"><i className="ti ti-folder" /></span>
                <span className="rs-text">
                  <strong>{project.group}</strong>
                  <small>{researcherText(project)} · {adviserName(project) ? `Adviser: ${adviserName(project)}` : "No adviser"}</small>
                </span>
              </button>
              <span className="rs-hide-small">{project.currentStage?.name || "Not started"}</span>
              <span className="rs-hide-small"><MiniProgress value={project.progress} /></span>
              <StatusDot tone={statusTone(project.status)}>{statusLabel(project.status)}</StatusDot>
              {removeButton(project)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CoordinatorProjectDetail({ project, onBack, onReview }: { project: any; onBack: () => void; onReview: (submission: any) => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [project.id]);
  const currentSequence = project.currentStage?.sequence;
  const stageState = (stage: any) => {
    if (project.status === "completed") return "done";
    if (currentSequence === undefined) return "future";
    return stage.sequence < currentSequence ? "done" : stage.sequence === currentSequence ? "next" : "future";
  };
  const stages = project.workflowStages || [];
  const doneStages = stages.filter((stage: any) => stageState(stage) === "done").length;
  const toReview = (project.taskSubmissions || []).filter((item: any) => ["SUBMITTED", "UNDER_REVIEW"].includes(item.status)).length;
  const facts: [string, string][] = [
    ["Status", statusLabel(project.status)],
    ["Research type", project.researchType?.name || "Not specified"],
    ["Program", project.program?.code || project.program?.name || "Not specified"],
    ["Academic year", project.academicYear?.name || "Not specified"],
  ];
  return (
    <div className="rs">
      <RoleBand
        eyebrow="Research projects"
        onBack={onBack}
        backLabel="Back to research projects"
        title={<span id="project-detail-title">{project.title}</span>}
        titleId="coordinator-project-detail"
        meta={`Current stage: ${project.currentStage?.name || "Not started"}`}
        counts={[
          { label: "Progress", value: `${project.progress}%` },
          { label: "Milestones", value: `${doneStages}/${stages.length}` },
          { label: "To review", value: toReview, tone: toReview ? "waiting" : undefined },
        ]}
        countsLabel="Project summary"
      />
      <div className="rh-grid">
        <div className="rh-col">
          <section className="rh-panel" aria-labelledby="project-stages-title">
            <div className="rh-head"><h2 id="project-stages-title">Workflow stages</h2></div>
            <ul className="rh-rows">
              {stages.map((stage: any) => {
                const state = stageState(stage);
                const adviserMilestone = project.milestoneProgress?.find((item: any) => item.id === stage.id)?.adviserMilestone;
                const adviserStamp = adviserMilestone?.acceptedAt
                  ? `Accepted ${new Date(adviserMilestone.acceptedAt).toLocaleString()}`
                  : adviserMilestone?.status === "DECLINED" && adviserMilestone?.respondedAt
                    ? `Responded ${new Date(adviserMilestone.respondedAt).toLocaleString()}`
                    : adviserMilestone?.requestedAt
                      ? `Requested ${new Date(adviserMilestone.requestedAt).toLocaleString()}`
                      : "";
                return (
                  <li key={stage.id} className="rs-stage" data-state={state}>
                    <div className="rh-row">
                      <span className="rs-stage-num" aria-hidden="true">{state === "done" ? <i className="ti ti-check" /> : stage.sequence}</span>
                      <div className="rh-text">
                        <h3 className="rh-title">{stage.name}</h3>
                        <p>{formatMilestoneTarget(stage)}</p>
                        {stage.milestoneType === "ADVISER_SELECTION" && (
                          <p>
                            Adviser milestone · {(adviserMilestone?.status || "NOT_STARTED").replace(/_/g, " ").toLowerCase()}
                            {adviserMilestone?.adviser ? ` · ${adviserMilestone.adviser.firstName} ${adviserMilestone.adviser.lastName}` : ""}
                            {adviserStamp ? ` · ${adviserStamp}` : ""}
                          </p>
                        )}
                      </div>
                      <StatusDot tone={state === "done" ? "done" : state === "next" ? "waiting" : "neutral"}>
                        {state === "done" ? "Done" : state === "next" ? "Current" : "Not started"}
                      </StatusDot>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rh-panel" aria-labelledby="project-submissions-title">
            <div className="rh-head">
              <h2 id="project-submissions-title">Task submissions</h2>
              {(project.taskSubmissions?.length ?? 0) > 0 && <span className="rh-pill">{project.taskSubmissions.length}</span>}
            </div>
            {project.taskSubmissions?.length ? (
              <ul className="rh-rows">
                {project.taskSubmissions.map((submission: any) => (
                  <li key={submission.id}>
                    <div className="rh-row">
                      <span className="rh-icon" aria-hidden="true"><i className="ti ti-file-text" /></span>
                      <div className="rh-text">
                        <h3>{submission.task?.title}</h3>
                        <p>{submission.document?.title}</p>
                      </div>
                      <StatusDot tone={submission.status === "APPROVED" ? "done" : submission.status === "REVISION_REQUIRED" ? "attention" : "waiting"}>
                        {submission.status.replace(/_/g, " ").toLowerCase()}
                      </StatusDot>
                      <button type="button" className="rs-primary" onClick={() => onReview(submission)}>Review</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rh-space"><EmptyNote layout="row" icon="ti-file-text" title="No task submissions yet" text="Work submitted by this group will appear here." /></div>
            )}
          </section>
        </div>
        <div className="rh-col">
          <section className="rh-panel" aria-labelledby="project-adviser-title">
            <div className="rh-head"><h2 id="project-adviser-title">Adviser</h2></div>
            {project.adviser ? (
              <div className="rs-who" style={{ marginTop: 12 }}>
                <span className="rs-avatar" data-tone="dark" aria-hidden="true">{initials(adviserName(project) || "")}</span>
                <span className="rs-text"><strong>{adviserName(project)}</strong><small>{project.adviser.email}</small></span>
              </div>
            ) : (
              <p className="rh-lede" style={{ marginTop: 10 }}>No adviser has been assigned yet.</p>
            )}
          </section>
          <section className="rh-panel" aria-labelledby="project-researchers-title">
            <div className="rh-head">
              <h2 id="project-researchers-title">Researchers</h2>
              {project.researchers.length > 0 && <span className="rh-pill">{project.researchers.length}</span>}
            </div>
            {project.researchers.length ? (
              project.researchers.map((member: any) => {
                const name = `${member.user.firstName} ${member.user.lastName}`;
                return (
                  <div key={member.id} className="rs-who" style={{ marginTop: 12 }}>
                    <span className="rs-avatar" aria-hidden="true">{initials(name)}</span>
                    <span className="rs-text">
                      <strong>{name}</strong>
                      <small>{member.user.email} · {member.projectRole === "LEADER" ? "Leader" : "Member"}</small>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="rh-lede" style={{ marginTop: 10 }}>No researchers have been assigned.</p>
            )}
          </section>
          <section className="rh-panel" aria-labelledby="project-about-title">
            <div className="rh-head"><h2 id="project-about-title">About this project</h2></div>
            <p className="rh-lede" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{project.abstract || "No project description has been added yet."}</p>
            <dl className="rs-facts">
              {facts.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

export function CoordinatorProgress({ projects, onOpen }: { projects: any[]; onOpen: (project: any) => void }) {
  const [filter, setFilter] = useState<"all" | "behind" | "early" | "mid" | "done">("all");
  const [sort, setSort] = useState<"behind" | "ahead">("behind");
  const [search, setSearch] = useState("");
  const [view, setView] = useScreenView("advisio:coordinator-progress-view", "list");
  const bucket = (progress: number) => (progress >= 100 ? "done" : progress < 25 ? "behind" : progress < 50 ? "early" : "mid");
  const count = (value: string) => projects.filter((project) => bucket(project.progress) === value).length;
  const average = projects.length ? Math.round(projects.reduce((total, project) => total + project.progress, 0) / projects.length) : 0;
  const query = search.trim().toLowerCase();
  const rows = projects
    .filter((project) => (filter === "all" || bucket(project.progress) === filter) && `${project.title || project.group} ${project.currentStage?.name || ""}`.toLowerCase().includes(query))
    .sort((a, b) => (sort === "behind" ? a.progress - b.progress : b.progress - a.progress));
  const bandTone = (progress: number): ProgressTone | undefined => {
    const tone = progressTone(progress);
    return tone === "brand" ? undefined : tone;
  };
  const milestone = (project: any) => project.currentStage?.name || "Not started";
  return (
    <section data-tour="progress-records" className="rs" aria-labelledby="coordinator-progress-title">
      <RoleBand
        eyebrow="Course workspace"
        title="Research progress"
        titleId="coordinator-progress-title"
        meta={projects.length ? `Average completion is ${average}% · ${plural(count("behind"), "group is", "groups are")} furthest behind` : "Track each project's milestone completion."}
        counts={[
          { label: "Groups", value: projects.length },
          { label: "Average", value: `${average}%` },
          { label: "Behind", value: count("behind"), tone: count("behind") ? "waiting" : undefined },
          { label: "Complete", value: count("done") },
        ]}
        countsLabel="Progress summary"
      />
      {projects.length === 0 ? (
        <div className="rs-empty-card">
          <EmptyNote layout="row" icon="ti-chart-line" title="No projects to track yet" text="Projects will appear here once they have a workflow." />
        </div>
      ) : (
        <>
          <div className="rs-tools">
            <FilterChips
              label="Filter by progress"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: projects.length },
                { value: "behind", label: "Under 25%", count: count("behind") },
                { value: "early", label: "25 to 49%", count: count("early") },
                { value: "mid", label: "50 to 99%", count: count("mid") },
                { value: "done", label: "Complete", count: count("done") },
              ]}
            />
            <div className="rs-tools-end">
              <SearchField value={search} onChange={setSearch} placeholder="Search project or milestone" />
              <select className="rs-select" aria-label="Sort groups" value={sort} onChange={(event) => setSort(event.target.value as "behind" | "ahead")}>
                <option value="behind">Furthest behind</option>
                <option value="ahead">Most complete</option>
              </select>
              <ViewSwitch value={view} onChange={setView} />
            </div>
          </div>
          {!rows.length ? (
            <NoMatch title="No groups match" text="Try another filter or search." />
          ) : view === "cards" ? (
            <div className="rs-tiles">
              {rows.map((project) => (
                <button key={project.id} type="button" className="rs-tile" onClick={() => onOpen(project)}>
                  <span className="rs-tile-band" data-tone={bandTone(project.progress) === "brand" ? undefined : bandTone(project.progress)}>
                    <span>{project.program?.code || "Research project"}</span>
                    <span>{project.progress >= 100 ? "Complete" : project.progress < 25 ? "Behind" : "In progress"}</span>
                  </span>
                  <span className="rs-tile-body">
                    <span className="rs-tile-title">{project.title || project.group}</span>
                    <span className="rs-tile-foot">
                      <ProgressRing value={project.progress} tone={progressTone(project.progress)} />
                      <span className="rs-text"><small>Current milestone</small><strong>{milestone(project)}</strong></span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rs-table" style={{ "--rs-cols": "minmax(0,2.4fr) minmax(0,1fr) 170px 16px" } as CSSProperties}>
              {rows.map((project) => {
                const tone = bandTone(project.progress);
                return (
                  <button key={project.id} type="button" className="rs-row" aria-label={`${project.title || project.group}, ${project.progress}% complete`} onClick={() => onOpen(project)}>
                    <span className="rs-who">
                      <span className="rh-icon" data-tone={tone === "done" ? undefined : tone} aria-hidden="true"><i className="ti ti-chart-line" /></span>
                      <span className="rs-text"><strong>{project.title || project.group}</strong><small>{project.program?.code || "Research project"}</small></span>
                    </span>
                    <span className="rs-wide">{milestone(project)}</span>
                    <span className="rs-hide-small"><MiniProgress value={project.progress} /></span>
                    <i className="ti ti-chevron-right rs-chevron rs-hide-small" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
