import { CardLink, EmptyNote } from "@/components/ui/advisio";
import { MiniProgress, ProgressRing, ProgressTrack, progressTone } from "@/components/dashboards/RoleHomeParts";

type HomeProject = {
  id: string;
  title: string;
  stage: string;
  progress: number;
  risk: "low" | "medium" | "high";
  riskReason: string;
  adviser: string | null;
  program: { code: string };
};

type HomeAdviser = { id: string; groups: number; maxAdviseeGroups: number; isAcceptingAdvisees: boolean; isFull: boolean };

export type DeanHomeData = {
  metrics: { students: number; projects: number; pendingAccounts: number; withoutProject: number; withoutAdviser: number };
  programSummary: { id: string; code: string; name: string; students: number; projects: number; averageProgress: number; atRisk: number }[];
  stageDistribution: { stage: string; count: number }[];
  attention: HomeProject[];
  projects: HomeProject[];
  advisers: HomeAdviser[];
};

const riskLabel = { high: "High risk", medium: "Medium risk", low: "Needs a check" };
const riskTone = (risk: HomeProject["risk"]) => (risk === "high" ? "attention" : "waiting");
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function DeanHome({
  data,
  selectedProgramId,
  onSelectProgram,
  onOpenTab,
  onReviewGroup,
}: {
  data: DeanHomeData;
  selectedProgramId: string;
  onSelectProgram: (programId: string) => void;
  onOpenTab: (tab: string) => void;
  onReviewGroup: (project: HomeProject) => void;
}) {
  const [lead, ...others] = data.attention.slice(0, 5);
  const recent = data.projects.slice(0, 3);
  const { pendingAccounts, withoutProject, withoutAdviser } = data.metrics;

  const waiting = [
    { count: pendingAccounts, title: `${plural(pendingAccounts, "Student account", "Student accounts")} to approve`, clear: "No accounts to approve", where: "Students", tab: "students" },
    { count: withoutProject, title: `${plural(withoutProject, "Student", "Students")} without a project`, clear: "Every student has a project", where: "Students", tab: "students" },
    { count: withoutAdviser, title: `${plural(withoutAdviser, "Group", "Groups")} without an adviser`, clear: "Every group has an adviser", where: "Research Projects", tab: "research" },
  ];

  const usedSlots = data.advisers.reduce((total, adviser) => total + adviser.groups, 0);
  const totalSlots = data.advisers.reduce((total, adviser) => total + adviser.maxAdviseeGroups, 0);
  const paused = data.advisers.filter((adviser) => !adviser.isAcceptingAdvisees).length;
  const full = data.advisers.filter((adviser) => adviser.isAcceptingAdvisees && adviser.isFull).length;
  const open = data.advisers.length - paused - full;

  const programFocused = selectedProgramId !== "all";
  const programs = programFocused ? data.programSummary.filter((program) => program.id === selectedProgramId) : data.programSummary;

  const maxStage = Math.max(1, ...data.stageDistribution.map((item) => item.count));
  const peaks = data.stageDistribution.filter((item) => item.count === maxStage);
  const peak = peaks.length === 1 && peaks[0].count > 1 ? peaks[0] : null;

  return (
    <div className="rh">
      <div className="rh-grid">
        <section className="rh-panel" aria-labelledby="dean-attention-title">
          <div className="rh-head">
            <h2 id="dean-attention-title">Groups needing attention</h2>
            {data.attention.length > 0 && <span className="rh-pill" data-tone="attention">{data.attention.length}</span>}
            {data.attention.length > 0 && <CardLink onClick={() => onOpenTab("progress")}>View all</CardLink>}
          </div>
          {lead ? (
            <>
              <div className="rh-lead" data-tone={riskTone(lead.risk)}>
                <div className="rh-text">
                  <span className="rh-tag" data-tone={riskTone(lead.risk)}>
                    <i className="ti ti-alert-triangle" aria-hidden="true" /> {riskLabel[lead.risk]}
                  </span>
                  <h3>{lead.title}</h3>
                  <p>
                    {lead.program.code} · {lead.riskReason} · {lead.adviser ? `Adviser: ${lead.adviser}` : "No adviser"} · {lead.stage}
                  </p>
                </div>
                <button type="button" className="rh-cta" onClick={() => onReviewGroup(lead)}>
                  Review group <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
              {others.length > 0 && (
                <ul className="rh-rows">
                  {others.map((project) => (
                    <li key={project.id}>
                      <button type="button" className="rh-row" onClick={() => onReviewGroup(project)}>
                        <span className="rh-icon" data-tone={riskTone(project.risk)} aria-hidden="true">
                          <i className={`ti ${project.risk === "high" ? "ti-alert-triangle" : "ti-clock"}`} />
                        </span>
                        <span className="rh-text">
                          <span className="rh-title">{project.title}</span>
                          <span className="rh-meta">{project.program.code} · {project.riskReason} · {riskLabel[project.risk]}</span>
                        </span>
                        <MiniProgress value={project.progress} tone={riskTone(project.risk)} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="rh-space">
              <EmptyNote
                layout="row"
                tone="ok"
                icon="ti-circle-check"
                title={data.metrics.projects ? "Every group is moving on schedule" : "No research groups in this scope yet"}
                text={data.metrics.projects ? "Groups that fall behind or lose an adviser will show up here first." : "Registered groups will appear here once they begin their work."}
              />
              {recent.length > 0 && (
                <>
                  <h3 className="rh-subhead">Recently updated</h3>
                  <ul className="rh-rows">
                    {recent.map((project) => (
                      <li key={project.id}>
                        <button type="button" className="rh-row" onClick={() => onReviewGroup(project)}>
                          <span className="rh-icon" aria-hidden="true"><i className="ti ti-folder" /></span>
                          <span className="rh-text">
                            <span className="rh-title">{project.title}</span>
                            <span className="rh-meta">{project.program.code} · {project.stage}</span>
                          </span>
                          <MiniProgress value={project.progress} tone="brand" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>

        <div className="rh-col">
          <section className="rh-panel" aria-labelledby="dean-waiting-title">
            <div className="rh-head"><h2 id="dean-waiting-title">Waiting on you</h2></div>
            <ul className="rh-waits">
              {waiting.map((item) => (
                <li key={item.clear}>
                  {item.count > 0 ? (
                    <button type="button" className="rh-wait" onClick={() => onOpenTab(item.tab)}>
                      <span className="rh-wait-count">{item.count}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>Open {item.where}</small>
                      </span>
                      <i className="ti ti-chevron-right" aria-hidden="true" />
                    </button>
                  ) : (
                    <div className="rh-wait" data-zero="true">
                      <span className="rh-wait-count" aria-hidden="true"><i className="ti ti-check" /></span>
                      <span><strong>{item.clear}</strong></span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rh-panel" aria-labelledby="dean-capacity-title">
            <div className="rh-head">
              <h2 id="dean-capacity-title">Adviser capacity</h2>
              <CardLink onClick={() => onOpenTab("advisers")}>Advisers</CardLink>
            </div>
            {data.advisers.length ? (
              <>
                <p className="rh-capacity"><b>{usedSlots}</b><span>of {totalSlots} group {plural(totalSlots, "slot", "slots")} in use</span></p>
                <ProgressTrack className="rh-capacity-track" value={totalSlots ? (usedSlots / totalSlots) * 100 : 0} />
                <p className="rh-legend">
                  <span data-tone="open"><i aria-hidden="true" />{open} open</span>
                  <span data-tone="full"><i aria-hidden="true" />{full} full</span>
                  <span><i aria-hidden="true" />{paused} paused</span>
                </p>
              </>
            ) : (
              <div className="rh-space">
                <EmptyNote layout="row" icon="ti-user-plus" title="No advisers yet" text="Invited advisers and their open slots will appear here." />
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="rh-grid rh-grid--even">
        <section className="rh-panel" aria-labelledby="dean-programs-title">
          <div className="rh-head">
            <h2 id="dean-programs-title">Programs</h2>
            {data.programSummary.length > 0 && !programFocused && <span className="rh-pill">{data.programSummary.length}</span>}
            {programFocused && <CardLink onClick={() => onSelectProgram("all")}>Show all programs</CardLink>}
          </div>
          {programs.length ? (
            <>
              <p className="rh-lede">{programFocused ? "This page is focused on one program." : "Average progress per program. Select one to focus this page on it."}</p>
              <div className="rh-programs">
                {programs.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    className="rh-program"
                    aria-pressed={program.id === selectedProgramId}
                    aria-label={`${program.code}, ${program.averageProgress}% average progress`}
                    onClick={() => onSelectProgram(program.id === selectedProgramId ? "all" : program.id)}
                  >
                    <ProgressRing value={program.averageProgress} tone={progressTone(program.averageProgress)} />
                    <span>
                      <strong>{program.code}</strong>
                      <small>{program.students} {plural(program.students, "student", "students")} · {program.projects} {plural(program.projects, "group", "groups")}</small>
                      {program.atRisk > 0 ? <em data-tone="attention">{program.atRisk} at risk</em> : program.projects > 0 ? <em>On track</em> : null}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rh-space">
              <EmptyNote layout="row" icon="ti-school" title="No programs in this scope" text="Programs assigned to this college will appear here." />
            </div>
          )}
        </section>

        <section className="rh-panel" aria-labelledby="dean-pipeline-title">
          <div className="rh-head"><h2 id="dean-pipeline-title" data-orientation="dean-pipeline">Research pipeline</h2></div>
          {data.stageDistribution.length ? (
            <>
              <p className="rh-lede">Where groups are right now.</p>
              <ul className="rh-stages">
                {data.stageDistribution.map((item) => {
                  const isPeak = item.stage === peak?.stage;
                  return (
                    <li key={item.stage} data-peak={isPeak}>
                      <p className="rh-stage-line"><span>{item.stage}</span><b>{item.count}</b></p>
                      <ProgressTrack value={(item.count / maxStage) * 100} tone={isPeak ? "waiting" : "brand"} />
                    </li>
                  );
                })}
              </ul>
              {peak && (
                <p className="rh-callout">
                  <i className="ti ti-flag" aria-hidden="true" />
                  <span>Most groups are at <b>{peak.stage}</b>.</span>
                </p>
              )}
            </>
          ) : (
            <div className="rh-space">
              <EmptyNote layout="row" icon="ti-route" title="No workflow activity yet" text="Registered research groups will fill this pipeline." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
