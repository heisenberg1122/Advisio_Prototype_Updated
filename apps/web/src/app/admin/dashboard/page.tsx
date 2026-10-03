"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Filter,
  GraduationCap,
  Loader2,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import { useAuth } from "@/providers/auth-provider";

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
};

const riskTone = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300",
};

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "gold" | "green" | "red" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    gold: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

function ProgressBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const tone = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-[#C9A227]" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`${compact ? "h-1.5" : "h-2"} flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10`}>
        <div className={`h-full rounded-full ${tone} transition-all duration-300`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-bold text-slate-600 dark:text-slate-300">{value}%</span>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] px-6 text-center">
      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
      <p className="mt-3 font-bold text-slate-800 dark:text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function DeanDashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeView = searchParams.get("tab") || "overview";
  const [programId, setProgramId] = useState("all");
  const [academicYearId, setAcademicYearId] = useState("all");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
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

  const updateCapacity = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; maxAdviseeGroups: number; isAcceptingAdvisees: boolean; note: string }) =>
      apiClient.patch(`/api/users/${id}/adviser-capacity`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dean-dashboard"] });
      setNotice("Adviser capacity updated and the adviser was notified.");
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
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#0B3A53]" />
          <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading dean dashboard…</p>
        </div>
      </div>
    );

  if (dashboard.isError || !data)
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#101b2b] p-7 text-center shadow-xs">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">Dashboard unavailable</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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

  const maxStageCount = Math.max(1, ...data.stageDistribution.map((item) => item.count));
  return (
    <div className="min-h-full bg-transparent text-slate-800 transition-colors dark:text-slate-100">
      {notice && (
        <div className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-3 text-sm font-bold text-white shadow-xl border border-[#C9A227]/30">
          <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
          {notice}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {activeView === "overview" && (
          <DashboardWelcome
            firstName={user?.firstName}
            fallbackName="Dean"
            summary="Here's an overview of research progress, programs, and academic activity across your college."
          />
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="relative min-w-44 flex-1 sm:flex-none">
                <span className="sr-only">Academic year</span>
                <select
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-xs font-bold text-slate-700 shadow-xs outline-none focus:border-[#C9A227] dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-auto sm:min-w-44"
                >
                  <option value="all">All academic years</option>
                  {data.scope.academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isCurrent ? " · Current" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              </label>

              <label className="relative min-w-56 flex-1 sm:flex-none">
                <span className="sr-only">Program</span>
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-xs font-bold text-slate-700 shadow-xs outline-none focus:border-[#C9A227] dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-auto sm:min-w-56"
                >
                  <option value="all">All programs</option>
                  {data.scope.programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.code} · {program.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              </label>
        </div>

        {/* OVERVIEW TAB */}
        {activeView === "overview" && (
          <div className="space-y-6">
            {/* KEY METRICS GRID */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Research Students",
                  value: data.metrics.students,
                  suffix: `${data.metrics.withoutProject} unassigned`,
                  icon: UserRound,
                  tone: "text-[#0B3A53] dark:text-[#C9A227] bg-[#0B3A53]/5 dark:bg-white/10",
                },
                {
                  label: "Research Groups",
                  value: data.metrics.projects,
                  suffix: `${data.metrics.withoutAdviser} no adviser`,
                  icon: UsersRound,
                  tone: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
                },
                {
                  label: "On-Track Groups",
                  value: data.metrics.onTrack,
                  suffix: "within timeline",
                  icon: TrendingUp,
                  tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                },
                {
                  label: "High-Risk Groups",
                  value: data.metrics.atRisk,
                  suffix: "require attention",
                  icon: AlertTriangle,
                  tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:border-white/10 dark:bg-[#101b2b]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${metric.tone} transition-transform duration-200 group-hover:scale-105`}>
                      <metric.icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block truncate">
                        {metric.label}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                          {metric.value}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                          · {metric.suffix}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2.5">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Live college tally</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              ))}
            </section>

            {/* PERFORMANCE & PIPELINE */}
            <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Research Program Overview</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Research participation and average workflow completion across departments.
                    </p>
                  </div>
                  <Pill tone="blue">Current Scope</Pill>
                </div>
                <div className="mt-6 space-y-5">
                  {data.programSummary.map((program) => (
                    <div key={program.id}>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white">{program.code}</span>
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                            {program.students} students · {program.projects} groups
                          </span>
                        </div>
                        {program.atRisk > 0 && <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{program.atRisk} at risk</span>}
                      </div>
                      <ProgressBar value={program.averageProgress} />
                    </div>
                  ))}
                  {!data.programSummary.length && <EmptyState title="No programs in scope" detail="Programs assigned to this college will appear here." />}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Research Pipeline</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">Groups distributed by active workflow milestone.</p>
                <div className="mt-6 space-y-4">
                  {data.stageDistribution.map((item) => (
                    <div key={item.stage}>
                      <div className="mb-1.5 flex justify-between gap-3 text-xs">
                        <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{item.stage}</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0B3A53] to-[#C9A227]"
                          style={{ width: `${(item.count / maxStageCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {!data.stageDistribution.length && <EmptyState title="No workflow activity" detail="Registered research groups will populate this pipeline." />}
                </div>
              </article>
            </section>

            {/* ATTENTION & DECISION QUEUE */}
            <section className="grid gap-6 xl:grid-cols-[1fr_.85fr]">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Needs Dean Attention</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">Priority bottlenecks and overdue research milestones.</p>
                  </div>
                  <Pill tone={data.attention.length ? "red" : "green"}>{data.attention.length} items</Pill>
                </div>
                <div className="mt-5 space-y-3">
                  {data.attention.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-100/60 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${riskTone[project.risk]}`}>
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{project.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {project.program.code} · {project.riskReason}
                        </p>
                      </div>
                      <Pill tone={project.risk === "high" ? "red" : "gold"}>{project.risk}</Pill>
                    </div>
                  ))}
                  {!data.attention.length && (
                    <EmptyState title="Everything is on track" detail="No research groups currently require dean intervention." />
                  )}
                </div>
              </article>

              <article className="rounded-2xl bg-gradient-to-br from-[#0B3A53] to-[#072A3D] p-6 text-white shadow-xl shadow-[#0B3A53]/10 border border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#F4D03F]">Decision Queue</p>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-200">Pending Actions</span>
                </div>
                <h2 className="mt-2 text-2xl font-black">What needs action today</h2>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Pending student accounts", value: data.metrics.pendingAccounts, icon: UserCheck },
                    { label: "Students without projects", value: data.metrics.withoutProject, icon: BookOpen },
                    { label: "Groups without advisers", value: data.metrics.withoutAdviser, icon: ShieldAlert },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.07] p-4 transition-all hover:bg-white/[.12]"
                    >
                      <item.icon className="h-5 w-5 text-[#F4D03F]" />
                      <span className="flex-1 text-sm font-semibold text-slate-100">{item.label}</span>
                      <span className="text-xl font-black text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Recent Research Activity</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Latest project updates recorded within your college scope.</p>
                  </div>
                  <a href="/admin/dashboard?tab=research" className="shrink-0 text-xs font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]">View projects <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></a>
                </div>
                <div className="mt-5 space-y-3">
                  {data.projects.slice(0, 4).map((project) => (
                    <a key={project.id} href="/admin/dashboard?tab=research" className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/[0.02]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]"><BookOpen className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-slate-900 dark:text-white">{project.title}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{project.program.code} · {project.stage} · {project.progress}% complete</span>
                      </span>
                      <Pill tone={project.risk === "high" ? "red" : project.risk === "medium" ? "gold" : "green"}>{project.risk}</Pill>
                    </a>
                  ))}
                  {!data.projects.length && <EmptyState title="No recent research activity" detail="Project updates will appear here as research groups begin their work." />}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Quick Actions</h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Open the college workspaces you use most often.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: "Research students", href: "/admin/dashboard?tab=students", icon: UserRound },
                    { label: "Research projects", href: "/admin/dashboard?tab=research", icon: BookOpen },
                    { label: "Progress monitoring", href: "/admin/dashboard?tab=progress", icon: TrendingUp },
                    { label: "Adviser workload", href: "/admin/dashboard?tab=advisers", icon: UsersRound },
                  ].map((action) => (
                    <a key={action.label} href={action.href} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-[#0B3A53]/30 hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/[0.02]">
                      <action.icon className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227]" />
                      <span className="mt-3 block text-xs font-bold text-slate-900 dark:text-white">{action.label}</span>
                    </a>
                  ))}
                </div>
              </article>
            </section>
          </div>
        )}

        {/* REGISTRY VIEWS */}
        {(activeView === "students" || activeView === "research" || activeView === "progress") && (
          <RegistryView
            activeView={activeView}
            search={search}
            setSearch={setSearch}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            students={filteredStudents}
            projects={filteredProjects}
            updateStatus={(id, status) => updateStatus.mutate({ id, status })}
            updating={updateStatus.isPending}
          />
        )}

        {/* ADVISERS TAB */}
        {activeView === "advisers" && (
          <AdviserWorkloadView
            advisers={data.advisers}
            saving={updateCapacity.isPending}
            onSave={(payload) => updateCapacity.mutateAsync(payload)}
          />
        )}

        {!["overview", "students", "research", "progress", "advisers"].includes(activeView) && (
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
  saving,
  onSave,
}: {
  advisers: Adviser[];
  saving: boolean;
  onSave: (payload: { id: string; maxAdviseeGroups: number; isAcceptingAdvisees: boolean; note: string }) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Adviser | null>(null);
  const [maximum, setMaximum] = useState(5);
  const [accepting, setAccepting] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (adviser: Adviser) => {
    setSelected(adviser);
    setMaximum(adviser.maxAdviseeGroups);
    setAccepting(adviser.isAcceptingAdvisees);
    setNote("");
    setError(null);
  };

  const submit = async () => {
    if (!selected) return;
    if (!Number.isInteger(maximum) || maximum < 0 || maximum > 50) return setError("Enter a whole number from 0 to 50.");
    if (note.trim().length < 10) return setError("Add a reason of at least 10 characters for the audit record.");
    try {
      await onSave({ id: selected.id, maxAdviseeGroups: maximum, isAcceptingAdvisees: accepting, note: note.trim() });
      setSelected(null);
    } catch (caught: any) {
      setError(caught?.message || "Unable to update capacity.");
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Adviser Capacity & Workload</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active groups count toward the limit. Pending requests do not reserve a slot.
            </p>
          </div>
          <Pill tone="blue">Dean controlled</Pill>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {advisers.map((adviser) => {
            const percent = adviser.maxAdviseeGroups
              ? Math.min(100, (adviser.groups / adviser.maxAdviseeGroups) * 100)
              : 100;
            return (
              <article
                key={adviser.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#101b2b]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0B3A53] font-black text-white shadow-xs">
                    {adviser.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-extrabold text-slate-900 dark:text-white">{adviser.name}</h3>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{adviser.email}</p>
                  </div>
                  <Pill tone={!adviser.isAcceptingAdvisees ? "slate" : adviser.isFull ? "red" : "green"}>
                    {!adviser.isAcceptingAdvisees ? "Paused" : adviser.isFull ? "Full" : "Open"}
                  </Pill>
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {adviser.groups}
                      <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                        {" "}
                        / {adviser.maxAdviseeGroups}
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active advisee groups</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400">{adviser.attention}</p>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">need attention</p>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${adviser.isFull ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {adviser.availableSlots} {adviser.availableSlots === 1 ? "slot" : "slots"} available
                  </span>
                  <button
                    onClick={() => open(adviser)}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-extrabold text-[#0B3A53] hover:border-[#C9A227] hover:bg-slate-50 dark:border-white/15 dark:text-[#38bdf8] dark:hover:bg-white/5 transition"
                  >
                    Set capacity
                  </button>
                </div>
              </article>
            );
          })}
          {!advisers.length && (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No advisers found" detail="Verified advisers in this college will appear here." />
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capacity-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-white/10 dark:bg-[#101b2b]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#C9A227]">Adviser workload</p>
                <h2 id="capacity-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                  Set {selected.name}’s capacity
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Currently advising {selected.groups} active groups.
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                aria-label="Close"
              >
                <span aria-hidden>×</span>
              </button>
            </div>

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
            {maximum < selected.groups && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
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

            <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Reason for change
              <textarea
                rows={4}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required for the audit record (minimum 10 characters)"
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-[#C9A227] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
            </label>
            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-xl bg-[#C9A227] hover:bg-[#B38E1B] px-5 py-2.5 text-sm font-extrabold text-[#0B3A53] shadow-xs disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save capacity"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function RegistryView({
  activeView,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  students,
  projects,
  updateStatus,
  updating,
}: {
  activeView: string;
  search: string;
  setSearch: (value: string) => void;
  riskFilter: string;
  setRiskFilter: (value: string) => void;
  students: Student[];
  projects: Project[];
  updateStatus: (id: string, status: string) => void;
  updating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
      <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-white/10 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {activeView === "students"
              ? "Students Taking Research"
              : activeView === "progress"
              ? "Research Progress and Risk"
              : "Research Group Registry"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing records within the selected college, program, and academic year.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records…"
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none focus:border-[#0B3A53] dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </label>
          {activeView !== "students" && (
            <label className="relative">
              <Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold dark:border-white/10 dark:bg-[#101b2b] dark:text-white"
              >
                <option value="all">All risks</option>
                <option value="high">High risk</option>
                <option value="medium">Medium risk</option>
                <option value="low">On track</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {activeView === "students" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-extrabold dark:bg-white/[0.02] dark:text-slate-400">
              <tr>
                {["Student", "Program", "Research group", "Adviser", "Stage", "Progress", "Account", "Action"].map((heading) => (
                  <th key={heading} className="px-5 py-3 font-extrabold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-extrabold text-slate-900 dark:text-white">{student.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {student.universityId} · {student.email}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">{student.program?.code || "—"}</td>
                  <td className="max-w-56 px-5 py-4">
                    <p className="truncate text-slate-700 dark:text-slate-300">{student.project?.title || "Not registered"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{student.adviser || "—"}</td>
                  <td className="px-5 py-4">
                    <Pill tone={student.project ? "blue" : "gold"}>{student.stage}</Pill>
                  </td>
                  <td className="w-36 px-5 py-4">
                    <ProgressBar value={student.progress} compact />
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={student.accountStatus === "ACTIVE" ? "green" : student.accountStatus === "PENDING" ? "gold" : "red"}>
                      {student.accountStatus}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    {student.accountStatus === "PENDING" ? (
                      <button
                        disabled={updating}
                        onClick={() => updateStatus(student.id, "ACTIVE")}
                        className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-xs font-extrabold text-[#0B3A53] hover:brightness-105 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    ) : student.accountStatus === "ACTIVE" ? (
                      <button
                        disabled={updating}
                        onClick={() => updateStatus(student.id, "SUSPENDED")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && (
            <div className="p-6">
              <EmptyState title="No students found" detail="Try changing your search or program filter." />
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 font-extrabold dark:bg-white/[0.02] dark:text-slate-400">
              <tr>
                {["Research project", "Program", "Students", "Adviser", "Current stage", "Progress", "Risk"].map((heading) => (
                  <th key={heading} className="px-5 py-3 font-extrabold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="max-w-xs px-5 py-4">
                    <p className="truncate font-extrabold text-slate-900 dark:text-white">{project.title}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{project.researchType}</p>
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">{project.program.code}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{project.students.length}</td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{project.adviser || <span className="font-bold text-rose-600">Unassigned</span>}</td>
                  <td className="px-5 py-4">
                    <Pill tone="blue">{project.stage}</Pill>
                  </td>
                  <td className="w-40 px-5 py-4">
                    <ProgressBar value={project.progress} compact />
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold capitalize ${riskTone[project.risk]}`}>
                      {project.risk}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{project.riskReason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!projects.length && (
            <div className="p-6">
              <EmptyState title="No research projects found" detail="Try changing your search, risk, or program filter." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B3A53]" />
        </div>
      }
    >
      <DeanDashboardContent />
    </Suspense>
  );
}

