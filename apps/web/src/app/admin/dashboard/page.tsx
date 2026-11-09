"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatAdminLink } from "@/lib/dashboard-navigation";
import { CountStrip, PageBand } from "@/components/ui/advisio";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Button } from "@/components/ui/Button";
import { PhoneFilters } from "@/components/ui/PhoneFilters";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useIsPhone } from "@/hooks/use-is-phone";
import { DeanAnnouncements } from "@/components/workflow/DeanAnnouncements";
import { DeanDefensesView } from "@/components/dean/DeanDefensesView";
import { DeanReportsView } from "@/components/dean/DeanReportsView";
import { DeanHome } from "@/components/dean/DeanHome";
import { DeanAdvisersView, DeanResearchView, DeanRiskView, DeanStudentsView } from "@/components/dean/DeanRegistryViews";

type Program = { id: string; code: string; name: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Project = {
  id: string;
  title: string;
  status: string;
  stage: string;
  progress: number;
  risk: "low" | "medium" | "high";
  riskReason: string;
  adviser: string | null;
  program: Program;
  researchType: string;
  updatedAt: string;
  students: { id: string; name: string }[];
};

type Student = {
  id: string;
  universityId: string;
  name: string;
  email: string;
  program: Program | null;
  accountStatus: string;
  project: { id: string; title: string } | null;
  adviser: string | null;
  stage: string;
  progress: number;
  risk: "low" | "medium" | "high";
  lastLoginAt: string | null;
};

type Adviser = {
  id: string;
  name: string;
  email: string;
  groups: number;
  attention: number;
  adviseeCount: number;
  maxAdviseeGroups: number;
  availableSlots: number;
  isAcceptingAdvisees: boolean;
  isFull: boolean;
  capacityNote?: string | null;
  canManageSettings?: boolean;
  program: Program | null;
};

type AdviserCandidate = {
  id: string;
  name: string;
  email: string;
  program: Program | null;
  roles: string[];
};

type DashboardData = {
  scope: { college: { id: string; code: string; name: string }; programs: Program[]; academicYears: AcademicYear[] };
  metrics: {
    students: number;
    projects: number;
    onTrack: number;
    atRisk: number;
    pendingAccounts: number;
    withoutProject: number;
    withoutAdviser: number;
  };
  programSummary: {
    id: string;
    code: string;
    name: string;
    students: number;
    projects: number;
    averageProgress: number;
    atRisk: number;
  }[];
  stageDistribution: { stage: string; count: number }[];
  attention: Project[];
  students: Student[];
  projects: Project[];
  advisers: Adviser[];
  adviserCandidates: AdviserCandidate[];
};

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] px-6 text-center">
      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
      <p className="mt-3 font-bold text-slate-800 dark:text-white">{title}</p>
      <p className="mt-1 max-w-sm text-base text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function DeanDashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  if (tab === "defenses") return <DeanDefensesView />;
  if (tab === "reports") return <DeanReportsView />;
  return <ExistingDeanDashboardContent />;
}

function ExistingDeanDashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeView = searchParams.get("tab") || "overview";
  const router = useRouter();
  const openTab = (tab: string) => router.push(formatAdminLink(`/admin/dashboard?tab=${tab}`, "dean"));
  const [programId, setProgramId] = useState("all");
  const [academicYearId, setAcademicYearId] = useState("all");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const isPhone = useIsPhone();
  const [notice, setNotice] = useState<string | null>(null);
  // A group opened from Home filters Progress & Risk; going back to Home clears that filter.
  useEffect(() => {
    if (activeView === "overview") setSearch("");
  }, [activeView]);
  const reviewGroup = (project: { title: string }) => {
    setSearch(project.title);
    setRiskFilter("all");
    openTab("progress");
  };
  const dashboard = useQuery({
    queryKey: ["dean-dashboard", programId, academicYearId],
    queryFn: () => apiClient.get<DashboardData>("/api/dean/dashboard", { params: { programId, academicYearId } }),
    staleTime: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiClient.patch(`/api/dean/users/${id}/status`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dean-dashboard"] });
      setNotice("Account status updated successfully.");
      window.setTimeout(() => setNotice(null), 3000);
    },
  });

  const saveAdviser = useMutation({
    mutationFn: (payload: { mode: "add" | "edit"; id?: string; userId?: string; programId: string; maxAdviseeGroups: number; isAcceptingAdvisees: boolean; note?: string }) => {
      const { mode, id, ...body } = payload;
      return mode === "add"
        ? apiClient.post("/api/dean/advisers", body)
        : apiClient.patch(`/api/dean/advisers/${id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dean-dashboard"] });
      setNotice("Adviser directory updated and the faculty member was notified.");
      window.setTimeout(() => setNotice(null), 3000);
    },
  });

  const removeAdviser = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/dean/advisers/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dean-dashboard"] });
      setNotice("Adviser role removed. The faculty account and history were preserved.");
      window.setTimeout(() => setNotice(null), 3000);
    },
  });

  const data = dashboard.data;

  const filteredProjects = useMemo(
    () =>
      (data?.projects || []).filter(
        (project) =>
          `${project.title} ${project.adviser || ""} ${project.program.code}`.toLowerCase().includes(search.toLowerCase()) &&
          (riskFilter === "all" || project.risk === riskFilter)
      ),
    [data?.projects, search, riskFilter]
  );

  const filteredStudents = useMemo(
    () =>
      (data?.students || []).filter((student) =>
        `${student.name} ${student.email} ${student.universityId} ${student.program?.code || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [data?.students, search]
  );

  if (dashboard.isLoading)
    return <DashboardSkeleton />;

  if (dashboard.isError || !data)
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#101b2b] p-7 text-center shadow-xs">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">Dashboard unavailable</h2>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
          {dashboard.error instanceof Error ? dashboard.error.message : "We could not load your college data."}
        </p>
        <button
          onClick={() => dashboard.refetch()}
          className="mt-5 rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#0E4968]"
        >
          Try again
        </button>
      </div>
    );

  const isRegistryView = activeView === "students" || activeView === "research" || activeView === "progress";
  const scopeFilterCount = Number(academicYearId !== "all") + Number(programId !== "all");
  const clearScopeFilters = () => {
    setAcademicYearId("all");
    setProgramId("all");
  };
  const scopeFilterFields = (
    <>
      <label className="relative min-w-44 flex-1 sm:flex-none">
        <span className="sr-only">Academic year</span>
        <select
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
          className="h-[38px] w-full appearance-none rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-9 text-[13px] font-semibold text-[var(--color-text-primary)] sm:w-auto sm:min-w-44"
        >
          <option value="all">All academic years</option>
          {data.scope.academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
              {year.isCurrent ? " · Current" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-[11px] h-4 w-4 text-[var(--color-text-secondary)]" />
      </label>

      <label className="relative min-w-56 flex-1 sm:flex-none">
        <span className="sr-only">Program</span>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="h-[38px] w-full appearance-none rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-9 text-[13px] font-semibold text-[var(--color-text-primary)] sm:w-auto sm:min-w-52"
        >
          <option value="all">All programs</option>
          {data.scope.programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} · {program.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-[11px] h-4 w-4 text-[var(--color-text-secondary)]" />
      </label>
    </>
  );
  return (
    <div className="min-h-full bg-transparent text-slate-800 transition-colors dark:text-slate-100">
      {notice && (
        <div className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-3 text-sm font-bold text-white shadow-xl border border-[#C9A227]/30">
          <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
          {notice}
        </div>
      )}

      <div className={`workspace-page flex w-full flex-col gap-6 ${activeView === "messages" ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}>
        {activeView === "overview" && (
          <PageBand
            variant="home"
            className="role-hero"
            titleId="dean-greeting"
            eyebrow="Dean workspace"
            title={`Good day, ${user?.firstName || "Dean"}`}
            meta={deanHeroStatus(data.metrics)}
            counts={
              <CountStrip
                label="College research summary"
                items={[
                  { label: "Students", value: data.metrics.students, onClick: () => openTab("students") },
                  { label: "Groups", value: data.metrics.projects, onClick: () => openTab("research") },
                  { label: "On track", value: data.metrics.onTrack, onClick: () => openTab("progress") },
                  { label: "High risk", value: data.metrics.atRisk, tone: "waiting", onClick: () => openTab("progress") },
                ]}
              />
            }
            actions={
              <>
                <Button size="sm" variant="secondary" onClick={() => openTab("progress")}>
                  Progress &amp; Risk <ArrowRight className="ml-1.5 inline h-4 w-4" aria-hidden="true" />
                </Button>
                {isPhone ? (
                  <>
                    <Button size="icon" variant="ghost" className="au-on-home" aria-label="Reports" icon={<i className="ti ti-report-analytics" aria-hidden="true" />} onClick={() => openTab("reports")} />
                    <PhoneFilters activeCount={scopeFilterCount} onClear={clearScopeFilters}>
                      {scopeFilterFields}
                    </PhoneFilters>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="au-on-home" icon={<i className="ti ti-report-analytics" aria-hidden="true" />} onClick={() => openTab("reports")}>
                      Reports
                    </Button>
                    <Button size="sm" variant="ghost" className="au-on-home" icon={<i className="ti ti-gavel" aria-hidden="true" />} onClick={() => openTab("defenses")}>
                      Defenses
                    </Button>
                  </>
                )}
              </>
            }
          />
        )}
        {activeView !== "messages" && activeView !== "announcements" && activeView !== "advisers" && !isRegistryView && !(isPhone && activeView === "overview") && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PhoneFilters activeCount={scopeFilterCount} onClear={clearScopeFilters}>
              {scopeFilterFields}
            </PhoneFilters>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeView === "overview" && (
          <DeanHome
            data={data}
            selectedProgramId={programId}
            onSelectProgram={setProgramId}
            onOpenTab={openTab}
            onReviewGroup={reviewGroup}
          />
        )}

        {/* REGISTRY VIEWS */}
        {(activeView === "students" || activeView === "research" || activeView === "progress") && (
          activeView === "students" ? (
            <DeanStudentsView
              students={filteredStudents}
              allStudents={data.students}
              search={search}
              setSearch={setSearch}
              scopeFilters={scopeFilterFields}
              scopeFilterCount={scopeFilterCount}
              onClearScopeFilters={clearScopeFilters}
              updateStatus={(id, status) => updateStatus.mutate({ id, status })}
              updating={updateStatus.isPending}
            />
          ) : activeView === "research" ? (
            <DeanResearchView
              projects={filteredProjects}
              allProjects={data.projects}
              search={search}
              setSearch={setSearch}
              scopeFilters={scopeFilterFields}
              scopeFilterCount={scopeFilterCount}
              onClearScopeFilters={clearScopeFilters}
            />
          ) : (
            <DeanRiskView
              projects={filteredProjects}
              allProjects={data.projects}
              search={search}
              setSearch={setSearch}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
              scopeFilters={scopeFilterFields}
              scopeFilterCount={scopeFilterCount}
              onClearScopeFilters={clearScopeFilters}
            />
          )
        )}

        {/* ADVISERS TAB */}
        {activeView === "advisers" && (
          <AdviserWorkloadView
            advisers={data.advisers}
            candidates={data.adviserCandidates || []}
            programs={data.scope.programs}
            saving={saveAdviser.isPending || removeAdviser.isPending}
            onSave={(payload) => saveAdviser.mutateAsync(payload)}
            onRemove={(id) => removeAdviser.mutateAsync(id)}
            canManage
            scopeFilters={scopeFilterFields}
            scopeFilterCount={scopeFilterCount}
            onClearScopeFilters={clearScopeFilters}
          />
        )}

        {activeView === "messages" && <FacultyGroupChats triggerToast={setNotice} />}
        {activeView === "announcements" && <DeanAnnouncements programs={data.scope.programs} assignedProgramId={user?.program?.id} />}

        {!["overview", "students", "research", "progress", "advisers", "messages", "announcements"].includes(activeView) && (
          <EmptyState
            title="Module coming in the next operational phase"
            detail="Defense scheduling, institutional calendar, and report exports will be connected after the dean monitoring foundation."
          />
        )}
      </div>
    </div>
  );
}

function AdviserWorkloadView({
  advisers,
  candidates,
  programs,
  saving: mutationPending,
  onSave,
  onRemove,
  canManage,
  scopeFilters,
  scopeFilterCount,
  onClearScopeFilters,
}: {
  scopeFilters: React.ReactNode;
  scopeFilterCount: number;
  onClearScopeFilters: () => void;
  advisers: Adviser[];
  candidates: AdviserCandidate[];
  programs: Program[];
  saving: boolean;
  onSave: (payload: { mode: "add" | "edit"; id?: string; userId?: string; programId: string; maxAdviseeGroups: number; isAcceptingAdvisees: boolean; note?: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  canManage: boolean;
}) {
  const adviserAction = useAsyncAction();
  const saving = mutationPending || adviserAction.isPending;
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Adviser | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [maximum, setMaximum] = useState(5);
  const [accepting, setAccepting] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    adviserAction.reset();
    const firstCandidate = candidates[0];
    setMode("add");
    setSelected(null);
    setCandidateId(firstCandidate?.id || "");
    setSelectedProgramId(firstCandidate?.program?.id || programs[0]?.id || "");
    setMaximum(5);
    setAccepting(true);
    setNote("");
    setError(null);
  };

  const openEdit = (adviser: Adviser) => {
    adviserAction.reset();
    setMode("edit");
    setSelected(adviser);
    setCandidateId("");
    setSelectedProgramId(adviser.program?.id || programs[0]?.id || "");
    setMaximum(adviser.maxAdviseeGroups);
    setAccepting(adviser.isAcceptingAdvisees);
    setNote("");
    setError(null);
  };

  const submit = async () => {
    if (!mode || (mode === "edit" && !selected)) return;
    if (mode === "add" && !candidateId) return setError("Choose a faculty account.");
    if (!selectedProgramId) return setError("Choose the program this adviser will serve.");
    if (!Number.isInteger(maximum) || maximum < 0 || maximum > 50) return setError("Enter a whole number from 0 to 50.");
    if (mode === "edit" && note.trim().length < 10) return setError("Add a reason of at least 10 characters for the audit record.");
    try {
      await adviserAction.run(
        async () => {
          await onSave({ mode, id: selected?.id, userId: mode === "add" ? candidateId : undefined, programId: selectedProgramId, maxAdviseeGroups: maximum, isAcceptingAdvisees: accepting, note: mode === "edit" ? note.trim() : undefined });
          setMode(null);
          setSelected(null);
        },
        {
          successMessage: mode === "add" ? "Adviser added successfully." : "Adviser changes saved.",
          errorMessage: (caught) => caught instanceof Error ? caught.message : "Unable to update adviser.",
        },
      );
    } catch {
      // Editor values remain available for retry.
    }
  };

  const remove = async (adviser: Adviser) => {
    if (!window.confirm("Remove " + adviser.name + " as an adviser? Their faculty account and academic history will be preserved.")) return;
    setError(null);
    try {
      await adviserAction.run(
        () => onRemove(adviser.id),
        {
          successMessage: `${adviser.name} was removed as an adviser.`,
          errorMessage: (caught) => caught instanceof Error ? caught.message : "Unable to remove adviser.",
        },
      );
    } catch {
      // The directory remains unchanged and the action is retryable.
    }
  };

  return (
    <>
      <div className="space-y-4">
        {!mode && (
          <ActionFeedback
            feedback={adviserAction.feedback}
            tone={error ? "error" : undefined}
            message={error}
          />
        )}
        <DeanAdvisersView
          advisers={advisers}
          canManage={canManage}
          saving={saving}
          scopeFilters={scopeFilters}
          scopeFilterCount={scopeFilterCount}
          onClearScopeFilters={onClearScopeFilters}
          onEdit={(adviser) => openEdit(adviser as Adviser)}
          onRemove={(adviser) => void remove(adviser as Adviser)}
        />
      </div>

      {canManage && mode && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adviser-editor-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-white/10 dark:bg-[#101b2b]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wider text-[#C9A227]">Adviser management</p>
                <h2 id="adviser-editor-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                  {mode === "add" ? "Add adviser" : "Edit " + selected?.name}
                </h2>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                  {mode === "add" ? "Assign an eligible faculty account to a program." : "Currently advising " + (selected?.groups || 0) + " active groups."}
                </p>
              </div>
              <button
                onClick={() => { setMode(null); setSelected(null); }}
                className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                aria-label="Close"
              >
                <span aria-hidden>×</span>
              </button>
            </div>

            {mode === "add" && (
              <label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Faculty account
                <select
                  value={candidateId}
                  onChange={(event) => {
                    setCandidateId(event.target.value);
                    const candidate = candidates.find((item) => item.id === event.target.value);
                    if (candidate?.program?.id) setSelectedProgramId(candidate.program.id);
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#C9A227] dark:border-white/15 dark:bg-[#101b2b] dark:text-white"
                >
                  <option value="">Choose faculty</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>
                  ))}
                </select>
              </label>
            )}

            <label className={`${mode === "add" ? "mt-4" : "mt-5"} block text-sm font-bold text-slate-700 dark:text-slate-200`}>
              Assigned program
              <select
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#C9A227] dark:border-white/15 dark:bg-[#101b2b] dark:text-white"
              >
                <option value="">Choose program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.code} · {program.name}</option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs font-normal text-slate-400">
                Only researchers from this program will see this adviser as eligible.
              </span>
            </label>

            <label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Maximum active groups
              <input
                type="number"
                min={0}
                max={50}
                step={1}
                value={maximum}
                onChange={(event) => setMaximum(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-[#C9A227] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            {mode === "edit" && selected && maximum < selected.groups && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-base font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                This is below the current workload. Existing assignments stay in place, but no new group can be accepted until the count falls below the limit.
              </p>
            )}

            <label className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-white/10 dark:bg-white/[0.02]">
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Accept new adviser requests</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  Turn off to pause requests without changing assignments.
                </span>
              </span>
              <input
                type="checkbox"
                checked={accepting}
                onChange={(event) => setAccepting(event.target.checked)}
                className="h-5 w-5 accent-[#0B3A53]"
              />
            </label>

            {mode === "edit" && (
              <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Reason for change
                <textarea
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Required for the audit record (minimum 10 characters)"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-base font-normal outline-none focus:border-[#C9A227] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </label>
            )}
            <ActionFeedback
              feedback={adviserAction.feedback}
              tone={error ? "error" : undefined}
              message={error}
              className="mt-3"
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => { setMode(null); setSelected(null); }}
                variant="secondary"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                status={adviserAction.status}
                loadingText="Saving adviser..."
                successText="Adviser saved"
                errorText="Try saving again"
              >
                {mode === "add" ? "Add adviser" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function deanHeroStatus({ projects, onTrack, atRisk }: { projects: number; onTrack: number; atRisk: number }) {
  if (atRisk > 0) return `${atRisk} high-risk ${atRisk === 1 ? "group needs" : "groups need"} attention · ${onTrack} on track`;
  if (!projects) return "No research groups in this scope yet";
  return onTrack === projects ? `All ${projects} groups on track · no high-risk groups` : `${onTrack} of ${projects} groups on track · no high-risk groups`;
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={<DashboardSkeleton />}
    >
      <DeanDashboardContent />
    </Suspense>
  );
}

