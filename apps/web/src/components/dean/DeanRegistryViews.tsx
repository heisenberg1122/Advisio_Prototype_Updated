import { useState, type CSSProperties, type ReactNode } from "react";
import { EmptyNote, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { PhoneFilters } from "@/components/ui/PhoneFilters";
import { MiniProgress, ProgressRing, ProgressTrack, progressTone } from "@/components/dashboards/RoleHomeParts";
import { FilterChips, RoleBand, SearchField, ViewSwitch, initials, plural, useScreenView } from "@/components/dashboards/RoleScreenParts";

type RegistryProgram = { code: string };
export type RegistryProject = {
  id: string;
  title: string;
  stage: string;
  progress: number;
  risk: "low" | "medium" | "high";
  riskReason: string;
  adviser: string | null;
  program: RegistryProgram;
  researchType: string;
  students: { id: string }[];
};
export type RegistryStudent = {
  id: string;
  universityId: string;
  name: string;
  email: string;
  program: RegistryProgram | null;
  accountStatus: string;
  project: { id: string; title: string } | null;
  adviser: string | null;
  stage: string;
  progress: number;
};

const eyebrow = "Research oversight";
const riskLabel = { high: "High risk", medium: "Medium risk", low: "On track" } as const;
const riskTone = { high: "attention", medium: "waiting", low: "done" } as const;
const accountTone = (status: string): StatusTone => (status === "ACTIVE" ? "done" : status === "PENDING" ? "waiting" : "attention");
const accountLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

function NoMatch({ title, text }: { title: string; text: string }) {
  return (
    <div className="rs-empty-card">
      <EmptyNote layout="row" icon="ti-search" title={title} text={text} />
    </div>
  );
}

type ToolProps = {
  search: string;
  setSearch: (value: string) => void;
  scopeFilters: ReactNode;
  scopeFilterCount: number;
  onClearScopeFilters: () => void;
};

function ScopeControls({ scopeFilters, scopeFilterCount, onClearScopeFilters }: Pick<ToolProps, "scopeFilters" | "scopeFilterCount" | "onClearScopeFilters">) {
  return (
    <PhoneFilters activeCount={scopeFilterCount} onClear={onClearScopeFilters}>
      {scopeFilters}
    </PhoneFilters>
  );
}

export function DeanStudentsView({
  students,
  allStudents,
  search,
  setSearch,
  scopeFilters,
  scopeFilterCount,
  onClearScopeFilters,
  updateStatus,
  updating,
}: ToolProps & {
  students: RegistryStudent[];
  allStudents: RegistryStudent[];
  updateStatus: (id: string, status: string) => void;
  updating: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "noProject" | "noAdviser">("all");
  const count = (test: (student: RegistryStudent) => boolean) => allStudents.filter(test).length;
  const tests = {
    all: () => true,
    pending: (student: RegistryStudent) => student.accountStatus === "PENDING",
    noProject: (student: RegistryStudent) => !student.project,
    noAdviser: (student: RegistryStudent) => Boolean(student.project) && !student.adviser,
  };
  const pending = count(tests.pending);
  const noProject = count(tests.noProject);
  const rows = students
    .filter(tests[filter])
    .sort((a, b) => Number(b.accountStatus === "PENDING") - Number(a.accountStatus === "PENDING"));
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Students taking research"
        titleId="dean-students-title"
        meta={`${plural(pending, "account needs", "accounts need")} approval · ${plural(noProject, "student has", "students have")} no project yet`}
        phoneStatus={pending ? plural(pending, "account needs approval", "accounts need approval") : noProject ? `${plural(noProject, "student has", "students have")} no project yet` : undefined}
        counts={[
          { label: "Students", value: allStudents.length },
          { label: "Active", value: count((student) => student.accountStatus === "ACTIVE") },
          { label: "To approve", value: pending, tone: pending ? "waiting" : undefined },
          { label: "No project", value: noProject },
        ]}
        countsLabel="Student summary"
      />
      <div className="rs-tools">
        <FilterChips
          label="Filter students"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: allStudents.length },
            { value: "pending", label: "To approve", count: pending },
            { value: "noProject", label: "No project", count: noProject },
            { value: "noAdviser", label: "No adviser", count: count(tests.noAdviser) },
          ]}
        />
        <div className="rs-tools-end phone-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder="Search name, ID or program" guide="de-monitor-search" />
          <ScopeControls scopeFilters={scopeFilters} scopeFilterCount={scopeFilterCount} onClearScopeFilters={onClearScopeFilters} />
        </div>
      </div>
      {rows.length ? (
        <div className="rs-table" data-phone-rows="0" data-phone-summary="3" style={{ "--rs-cols": "minmax(0,1.5fr) minmax(0,1.9fr) 120px 96px 110px" } as CSSProperties}>
          <div className="rs-row rs-row--head"><span>Student</span><span>Research group</span><span>Progress</span><span>Account</span><span /></div>
          {rows.map((student) => (
            <div key={student.id} className={`rs-row rs-row--hover${student.accountStatus === "PENDING" ? " rs-row--tint" : ""}`}>
              <div className="rs-who">
                <span className="rs-avatar" aria-hidden="true">{initials(student.name)}</span>
                <span className="rs-text">
                  <strong>{student.name}</strong>
                  <small>{student.universityId} · {student.program?.code || "No program"}</small>
                  <small>{student.email}</small>
                </span>
              </div>
              <span className="rs-text rs-wide">
                <strong data-weight="normal">{student.project?.title || "No project yet"}</strong>
                <small>{student.project ? `${student.adviser ? `Adviser: ${student.adviser}` : "No adviser"} · ${student.stage}` : "Not registered in a group"}</small>
              </span>
              <span className="rs-hide-small">{student.project ? <MiniProgress value={student.progress} /> : <StatusDot tone="neutral">Not started</StatusDot>}</span>
              <StatusDot tone={accountTone(student.accountStatus)}>{accountLabel(student.accountStatus)}</StatusDot>
              <div className="rs-actions">
                {student.accountStatus === "PENDING" ? (
                  <button type="button" className="rs-primary" disabled={updating} onClick={() => updateStatus(student.id, "ACTIVE")}>
                    <i className="ti ti-check" aria-hidden="true" /> Approve
                  </button>
                ) : student.accountStatus === "ACTIVE" ? (
                  <button type="button" className="rh-secondary" disabled={updating} onClick={() => updateStatus(student.id, "SUSPENDED")}>Suspend</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <NoMatch title="No students found" text="Try another filter, or change your search or program." />
      )}
    </div>
  );
}

export function DeanResearchView({
  projects,
  allProjects,
  search,
  setSearch,
  scopeFilters,
  scopeFilterCount,
  onClearScopeFilters,
}: ToolProps & { projects: RegistryProject[]; allProjects: RegistryProject[] }) {
  const [filter, setFilter] = useState<"all" | "noAdviser" | "high">("all");
  const [view, setView] = useScreenView("advisio:dean-research-view");
  const noAdviser = allProjects.filter((project) => !project.adviser).length;
  const high = allProjects.filter((project) => project.risk === "high").length;
  const rows = projects.filter((project) => filter === "all" || (filter === "noAdviser" ? !project.adviser : project.risk === "high"));
  const adviserText = (project: RegistryProject) => (project.adviser ? `Adviser: ${project.adviser}` : <span className="rs-missing">No adviser</span>);
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Research groups"
        titleId="dean-research-title"
        meta={`${plural(allProjects.length, "group", "groups")} in your college · ${plural(noAdviser, "group needs", "groups need")} an adviser`}
        phoneStatus={noAdviser ? `${plural(noAdviser, "group needs", "groups need")} an adviser` : undefined}
        counts={[
          { label: "Groups", value: allProjects.length },
          { label: "Students", value: allProjects.reduce((total, project) => total + project.students.length, 0) },
          { label: "Complete", value: allProjects.filter((project) => project.progress >= 100).length },
          { label: "No adviser", value: noAdviser, tone: noAdviser ? "waiting" : undefined },
        ]}
        countsLabel="Research group summary"
      />
      <div className="rs-tools">
        <FilterChips
          label="Filter research groups"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: allProjects.length },
            { value: "noAdviser", label: "No adviser", count: noAdviser },
            { value: "high", label: "High risk", count: high },
          ]}
        />
        <div className="rs-tools-end phone-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder="Search title, adviser or program" guide="de-monitor-search" />
          <ScopeControls scopeFilters={scopeFilters} scopeFilterCount={scopeFilterCount} onClearScopeFilters={onClearScopeFilters} />
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </div>
      {!rows.length ? (
        <NoMatch title="No research groups found" text="Try another filter, or change your search or program." />
      ) : view === "cards" ? (
        <div className="rs-tiles">
          {rows.map((project) => (
            <article key={project.id} className="rs-tile">
              <div className="rs-tile-band" data-tone={riskTone[project.risk]}>
                <span>{project.program.code} · {project.researchType}</span>
                <span>{riskLabel[project.risk]}</span>
              </div>
              <div className="rs-tile-body">
                <div>
                  <span className="rs-tile-title">{project.title}</span>
                  <span className="rs-tile-meta">{plural(project.students.length, "student", "students")} · {adviserText(project)}</span>
                </div>
                <div className="rs-tile-foot">
                  <ProgressRing value={project.progress} tone={progressTone(project.progress)} />
                  <span className="rs-text"><small>Current stage</small><strong>{project.stage}</strong></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rs-table" style={{ "--rs-cols": "minmax(0,2.4fr) 64px minmax(0,1fr) minmax(0,1fr) 130px" } as CSSProperties}>
          <div className="rs-row rs-row--head"><span>Research group</span><span>Students</span><span>Adviser</span><span>Stage</span><span>Progress</span></div>
          {rows.map((project) => (
            <div key={project.id} className="rs-row rs-row--hover">
              <div className="rs-who">
                <span className="rh-icon" data-tone={riskTone[project.risk] === "done" ? undefined : riskTone[project.risk]} aria-hidden="true"><i className="ti ti-folder" /></span>
                <span className="rs-text"><strong>{project.title}</strong><small>{project.program.code} · {project.researchType}</small></span>
              </div>
              <span className="rs-hide-small">{project.students.length}</span>
              <span className="rs-wide">{project.adviser || <span className="rs-missing">No adviser</span>}</span>
              <span className="rs-hide-small">{project.stage}</span>
              <span className="rs-hide-small"><MiniProgress value={project.progress} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DeanRiskView({
  projects,
  allProjects,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  scopeFilters,
  scopeFilterCount,
  onClearScopeFilters,
}: ToolProps & {
  projects: RegistryProject[];
  allProjects: RegistryProject[];
  riskFilter: string;
  setRiskFilter: (value: string) => void;
}) {
  const count = (risk: RegistryProject["risk"]) => allProjects.filter((project) => project.risk === risk).length;
  const average = allProjects.length ? Math.round(allProjects.reduce((total, project) => total + project.progress, 0) / allProjects.length) : 0;
  const levels = (["high", "medium", "low"] as const).filter((risk) => riskFilter === "all" || riskFilter === risk);
  const hints = { high: "Step in first", medium: "Watch closely", low: "No action needed" };
  const icons = { high: "ti-alert-triangle", medium: "ti-clock", low: "ti-circle-check" };
  const hasRows = levels.some((risk) => projects.some((project) => project.risk === risk));
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Progress and risk"
        phoneStatus={count("high") ? `${plural(count("high"), "group needs", "groups need")} your attention now` : undefined}
        titleId="dean-risk-title"
        meta={allProjects.length ? `${plural(count("high"), "group needs", "groups need")} your attention now · ${count("low")} on track` : "No research groups in this scope yet"}
        counts={[
          { label: "Groups", value: allProjects.length },
          { label: "Average", value: `${average}%` },
          { label: "On track", value: count("low") },
          { label: "High risk", value: count("high"), tone: count("high") ? "waiting" : undefined },
        ]}
        countsLabel="Risk summary"
      />
      <div className="rs-risks" role="group" aria-label="Filter by risk">
        {(["high", "medium", "low"] as const).map((risk) => (
          <button key={risk} type="button" className="rs-risk" data-tone={riskTone[risk]} aria-pressed={riskFilter === risk} onClick={() => setRiskFilter(riskFilter === risk ? "all" : risk)}>
            <b>{count(risk)}</b>
            <span className="rs-text"><strong>{riskLabel[risk]}</strong><small>{hints[risk]}</small></span>
          </button>
        ))}
      </div>
      <div className="rs-tools">
        {riskFilter !== "all" ? (
          <button type="button" className="rs-chip" onClick={() => setRiskFilter("all")}><i className="ti ti-x" aria-hidden="true" /> Show all</button>
        ) : <span />}
        <div className="rs-tools-end phone-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder="Search title or adviser" guide="de-monitor-search" />
          <ScopeControls scopeFilters={scopeFilters} scopeFilterCount={scopeFilterCount} onClearScopeFilters={onClearScopeFilters} />
        </div>
      </div>
      {hasRows ? (
        levels.map((risk) => {
          const rows = projects.filter((project) => project.risk === risk);
          if (!rows.length) return null;
          const tone = riskTone[risk];
          return (
            <section key={risk} className="rs" aria-label={riskLabel[risk]}>
              <h2 className="rs-section-title">{riskLabel[risk]} <span className="rh-pill" data-tone={tone === "done" ? undefined : tone}>{rows.length}</span></h2>
              <div className="rs-table" style={{ "--rs-cols": "minmax(0,2.3fr) minmax(0,1fr) 130px" } as CSSProperties}>
                {rows.map((project) => (
                  <div key={project.id} className="rs-row rs-row--hover">
                    <div className="rs-who">
                      <span className="rh-icon" data-tone={tone === "done" ? undefined : tone} aria-hidden="true"><i className={`ti ${icons[risk]}`} /></span>
                      <span className="rs-text">
                        <strong>{project.title}</strong>
                        <span className="rs-why" data-tone={tone}>{project.riskReason}</span>
                      </span>
                    </div>
                    <span className="rs-text rs-wide">
                      <strong data-weight="normal">{project.stage}</strong>
                      <small>{project.program.code} · {project.adviser || "No adviser"}</small>
                    </span>
                    <span className="rs-hide-small"><MiniProgress value={project.progress} tone={tone === "done" ? undefined : tone} /></span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <NoMatch title="No research groups found" text="Try another risk level, or change your search or program." />
      )}
    </div>
  );
}

export type WorkloadAdviser = {
  id: string;
  name: string;
  email: string;
  groups: number;
  attention: number;
  maxAdviseeGroups: number;
  availableSlots: number;
  isAcceptingAdvisees: boolean;
  isFull: boolean;
  canManageSettings?: boolean;
  program: { code: string; name: string } | null;
};

export function DeanAdvisersView({
  advisers,
  canManage,
  saving,
  onEdit,
  onRemove,
  scopeFilters,
  scopeFilterCount,
  onClearScopeFilters,
}: Pick<ToolProps, "scopeFilters" | "scopeFilterCount" | "onClearScopeFilters"> & {
  advisers: WorkloadAdviser[];
  canManage: boolean;
  saving: boolean;
  onEdit: (adviser: WorkloadAdviser) => void;
  onRemove: (adviser: WorkloadAdviser) => void;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "full" | "paused">("all");
  const [search, setSearch] = useState("");
  const state = (adviser: WorkloadAdviser) => (!adviser.isAcceptingAdvisees ? "paused" : adviser.isFull ? "full" : "open");
  const count = (value: "open" | "full" | "paused") => advisers.filter((adviser) => state(adviser) === value).length;
  const used = advisers.reduce((total, adviser) => total + adviser.groups, 0);
  const total = advisers.reduce((sum, adviser) => sum + adviser.maxAdviseeGroups, 0);
  const query = search.trim().toLowerCase();
  const rows = advisers.filter(
    (adviser) =>
      (filter === "all" || state(adviser) === filter) &&
      `${adviser.name} ${adviser.email} ${adviser.program?.code || ""}`.toLowerCase().includes(query),
  );
  const tones = { open: "done", full: "attention", paused: "neutral" } as const;
  return (
    <div className="rs">
      <RoleBand
        eyebrow={eyebrow}
        title="Advisers and workload"
        titleId="dean-advisers-title"
        guide="adviser-workload"
        meta={`${used} of ${total} group slots in use · ${plural(count("open"), "adviser is", "advisers are")} open for new groups`}
        counts={[
          { label: "Advisers", value: advisers.length },
          { label: "Open", value: count("open") },
          { label: "Full", value: count("full"), tone: count("full") ? "waiting" : undefined },
          { label: "Paused", value: count("paused") },
        ]}
        countsLabel="Adviser summary"
        primary={canManage ? { label: "Invite adviser", icon: "ti-plus", onClick: () => window.location.assign("/admin/faculty-access") } : undefined}
      />
      <div className="rs-tools">
        <FilterChips
          label="Filter advisers"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: advisers.length },
            { value: "open", label: "Open", count: count("open") },
            { value: "full", label: "Full", count: count("full") },
            { value: "paused", label: "Paused", count: count("paused") },
          ]}
        />
        <div className="rs-tools-end phone-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder="Search adviser or program" />
          <ScopeControls scopeFilters={scopeFilters} scopeFilterCount={scopeFilterCount} onClearScopeFilters={onClearScopeFilters} />
        </div>
      </div>
      {rows.length ? (
        <div className="rs-tiles">
          {rows.map((adviser) => {
            const current = state(adviser);
            return (
              <article key={adviser.id} className="rs-adviser">
                <div className="rs-adviser-top">
                  <span className="rs-avatar" data-tone="dark" aria-hidden="true">{initials(adviser.name)}</span>
                  <span className="rs-text">
                    <strong>{adviser.name}</strong>
                    <small>{adviser.email}</small>
                    <small>{adviser.program ? `${adviser.program.code} · ${adviser.program.name}` : "No program assigned"}</small>
                  </span>
                  <StatusDot tone={tones[current]}>{current.charAt(0).toUpperCase() + current.slice(1)}</StatusDot>
                </div>
                <div>
                  <div className="rs-load">
                    <span><b>{adviser.groups}</b> of {adviser.maxAdviseeGroups} groups</span>
                    <span>{plural(adviser.availableSlots, "slot", "slots")} free</span>
                  </div>
                  {adviser.maxAdviseeGroups > 0 && adviser.maxAdviseeGroups <= 12 ? (
                    <div className="rs-pips" data-full={adviser.isFull} aria-hidden="true">
                      {Array.from({ length: adviser.maxAdviseeGroups }, (_, index) => <i key={index} data-on={index < adviser.groups} />)}
                    </div>
                  ) : (
                    <div className="rs-pips" aria-hidden="true" style={{ display: "block" }}>
                      <ProgressTrack value={adviser.maxAdviseeGroups ? (adviser.groups / adviser.maxAdviseeGroups) * 100 : 100} tone={adviser.isFull ? "attention" : "brand"} />
                    </div>
                  )}
                </div>
                <div className="rs-adviser-foot">
                  <span>{adviser.attention ? <b>{plural(adviser.attention, "group needs", "groups need")} attention</b> : "No groups need attention"}</span>
                  {canManage && adviser.canManageSettings !== false && (
                    <span className="rs-actions">
                      <button type="button" className="rs-icon-btn" aria-label={`Edit ${adviser.name}`} onClick={() => onEdit(adviser)}><i className="ti ti-pencil" aria-hidden="true" /></button>
                      <button type="button" className="rs-icon-btn" data-tone="danger" disabled={saving} aria-label={`Remove ${adviser.name}`} onClick={() => onRemove(adviser)}><i className="ti ti-trash" aria-hidden="true" /></button>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <NoMatch title={advisers.length ? "No advisers found" : "No advisers yet"} text={advisers.length ? "Try another filter or search." : "Verified advisers in this college will appear here."} />
      )}
    </div>
  );
}
