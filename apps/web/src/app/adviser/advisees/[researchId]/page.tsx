import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  FileText,
  GraduationCap,
  History,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { calculateMilestoneProgress } from "@/lib/workflow-progress";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tag, type ExtendedTagVariant } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";

type WorkspaceSection =
  | "overview"
  | "documents"
  | "milestones"
  | "consultations"
  | "reviews"
  | "defense"
  | "activity";

interface WorkspaceData {
  project: any;
  documents: any[];
  documentPermissions: Record<string, boolean>;
  milestones: any[];
  activity: any[];
  consultations: any[];
  defenseSessions: any[];
}

const SECTION_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: GraduationCap },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "milestones", label: "Milestones", icon: ClipboardCheck },
  { id: "consultations", label: "Consultations", icon: CalendarClock },
  { id: "reviews", label: "Reviews & Feedback", icon: MessageSquareText },
  { id: "defense", label: "Defense", icon: ShieldCheck },
  { id: "activity", label: "Activity", icon: Activity },
];

const SECTION_IDS = new Set(SECTION_ITEMS.map((item) => item.id));

const readable = (value?: string | null, fallback = "Not available") =>
  value
    ? value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;

const localDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
});

const localDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : localDateFormatter.format(date);
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : localDateTimeFormatter.format(date);
};

const fullName = (user?: any) =>
  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Advisio user";

const statusVariant = (status?: string | null): ExtendedTagVariant => {
  const normalized = String(status || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "COMPLETED", "FINALIZED", "SCHEDULED", "ACCEPTED", "PUBLISHED"].includes(normalized)) return "success";
  if (["REJECTED", "DECLINED", "REVOKED", "FAILED"].includes(normalized)) return "danger";
  if (["REVISION_REQUIRED", "MAJOR_REVISION", "MINOR_REVISION", "PENDING", "REQUESTED", "AWAITING_REVIEW"].includes(normalized)) return "warning";
  return "info";
};

function SectionCard({
  title,
  description,
  action,
  children,
  className,
  scopeLabel,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scopeLabel?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-5", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {scopeLabel && <p className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">{scopeLabel}</p>}
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] sm:text-lg">{title}</h2>
          {description && <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)] sm:text-base">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function WorkspaceSkeleton() {
  return (
    <div role="status" aria-label="Loading research group workspace" className="mx-auto w-full max-w-[1800px] space-y-4">
      <span className="sr-only">Loading research group workspace</span>
      <Skeleton className="h-5 w-44" />
      <div className="rounded-3xl bg-[var(--color-primary)] p-5 sm:p-6">
        <Skeleton className="h-5 w-32 bg-white/20" />
        <Skeleton className="mt-4 h-8 w-4/5 max-w-3xl bg-white/25" />
        <Skeleton className="mt-3 h-4 w-1/2 bg-white/15" />
        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 bg-white/15" />)}
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-80 xl:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
          <span className="mt-0.5 block truncate text-lg font-black text-[var(--color-text-primary)]">{value}</span>
          {detail && <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">{detail}</span>}
        </span>
      </div>
    </div>
  );
}

function ActivityList({ items, limit }: { items: any[]; limit?: number }) {
  const sortedItems = [...items].sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
  const visible = typeof limit === "number" ? sortedItems.slice(0, limit) : sortedItems;
  if (!visible.length) {
    return <EmptyState size="sm" icon={Activity} title="No project activity yet" description="Recorded submissions, reviews, consultations, milestones, and defense events will appear here." />;
  }
  return (
    <ol className="space-y-1">
      {visible.map((item, index) => (
        <li key={item.id || `${item.type}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
          {index < visible.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px bg-[var(--color-border)]" aria-hidden="true" />}
          <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-primary)]">
            <Activity className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-base font-semibold text-[var(--color-text-primary)]">{item.title || readable(item.type, "Project activity")}</p>
              <time className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatDateTime(item.timestamp)}</time>
            </div>
            {item.description && <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">{item.description}</p>}
            {item.actor?.name && <p className="mt-1 text-base font-medium text-[var(--color-text-muted)]">By {item.actor.name}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AdviserResearchGroupWorkspacePage() {
  const { researchId = "" } = useParams<{ researchId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const requestedSection = searchParams.get("section") as WorkspaceSection | null;
  const activeSection = requestedSection && SECTION_IDS.has(requestedSection) ? requestedSection : "overview";
  const [fileAction, setFileAction] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAllDeadlines, setShowAllDeadlines] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["adviser", "research-group-workspace", researchId],
    enabled: Boolean(researchId),
    staleTime: 15_000,
    queryFn: async (): Promise<WorkspaceData> => {
      const projectResponse = await apiClient.get<{ project: any }>(`/api/research/${researchId}`);
      const [documentResponse, workflowResponse, consultationResponse, defenseResponse] = await Promise.all([
        apiClient.get<{ documents: any[]; permissions: Record<string, boolean> }>(`/api/research/${researchId}/documents`),
        apiClient.get<{ milestones: any[]; activity: any[] }>(`/api/research/${researchId}/manuscript-workflow`),
        apiClient.get<{ consultations: any[] }>("/api/consultations", { params: { researchId } }),
        apiClient.get<{ sessions: any[] }>("/api/defense-management").catch(() => ({ sessions: [] })),
      ]);
      return {
        project: projectResponse.project,
        documents: documentResponse.documents || [],
        documentPermissions: documentResponse.permissions || {},
        milestones: workflowResponse.milestones || [],
        activity: workflowResponse.activity || [],
        consultations: consultationResponse.consultations || [],
        defenseSessions: (defenseResponse.sessions || []).filter((session: any) => session.researchId === researchId),
      };
    },
  });

  const data = workspaceQuery.data;
  const project = data?.project;
  const studentMembers = useMemo(
    () => (project?.members || []).filter((member: any) => !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole)),
    [project],
  );
  const adviserMembership = project?.members?.find((member: any) => member.user?.id === user?.id && member.projectRole === "ADVISER" && !member.leftAt);
  const isSystemAdmin = user?.roles?.includes("SYSTEM_ADMIN");
  const hasWorkspaceAccess = Boolean(adviserMembership || isSystemAdmin);
  const progress = calculateMilestoneProgress(data?.milestones, Boolean(project?.workflowInstance?.completedAt));
  const pendingTaskCount = (data?.milestones || []).reduce(
    (count, milestone) => count + (milestone.tasks || []).filter((task: any) => task.isRequired && task.status !== "APPROVED").length,
    0,
  );
  const currentStage = project?.workflowInstance?.currentStage?.name || "Not started";

  const upcomingDeadlines = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const items: Array<{ id: string; label: string; detail: string; date: Date; type: string }> = [];
    const stages = [...(project?.workflowInstance?.workflow?.stages || [])].sort((a: any, b: any) => a.sequence - b.sequence);
    const milestoneById = new Map(data.milestones.map((milestone) => [milestone.id, milestone]));
    let cursor = project?.workflowInstance?.startedAt ? new Date(project.workflowInstance.startedAt) : null;
    for (const stage of stages) {
      if (!cursor || !stage.deadlineDays || stage.deadlineDays < 1) continue;
      cursor = new Date(cursor.getTime() + stage.deadlineDays * 86_400_000);
      const milestone: any = milestoneById.get(stage.id);
      if (cursor.getTime() >= now && !milestone?.completed) {
        items.push({ id: `milestone-${stage.id}`, label: stage.name, detail: "Milestone deadline", date: new Date(cursor), type: "milestone" });
      }
    }
    for (const consultation of data.consultations) {
      const date = new Date(consultation.scheduledStart);
      if (date.getTime() >= now) items.push({ id: `consultation-${consultation.id}`, label: consultation.topic || consultation.title, detail: "Consultation", date, type: "consultation" });
    }
    for (const session of data.defenseSessions) {
      const date = new Date(session.scheduledStart);
      if (date.getTime() >= now) items.push({ id: `defense-${session.id}`, label: session.defenseEvent?.defenseType ? readable(session.defenseEvent.defenseType) : "Research defense", detail: "Defense schedule", date, type: "defense" });
    }
    return items.sort((left, right) => left.date.getTime() - right.date.getTime());
  }, [data, project]);

  const reviewItems = useMemo(() => {
    return (data?.documents || []).flatMap((document) =>
      (document.versions || []).flatMap((version: any) => [
        ...(version.reviewerAssignments || []).map((assignment: any) => ({ kind: "assignment", document, version, assignment })),
        ...(version.reviews || []).filter((review: any) => !(version.reviewerAssignments || []).some((assignment: any) => assignment.review?.id === review.id)).map((review: any) => ({ kind: "review", document, version, review })),
      ]),
    ).sort((left: any, right: any) => new Date(right.assignment?.assignedAt || right.review?.submittedAt || right.review?.createdAt || 0).getTime() - new Date(left.assignment?.assignedAt || left.review?.submittedAt || left.review?.createdAt || 0).getTime());
  }, [data?.documents]);

  const defenseRequirements = useMemo(() => {
    if (!data) return [];
    const hasAdviser = (project?.members || []).some((member: any) => member.projectRole === "ADVISER" && !member.leftAt);
    const hasFinalManuscript = (project?.taskSubmissions || []).some((submission: any) => submission.status === "APPROVED") || data.documents.some((document) => document.documentType === "RESEARCH_MANUSCRIPT" && (document.versions || []).some((version: any) => version.status === "ACTIVE"));
    const hasSignedDeanApproval = data.documents.some((document) => document.documentType === "DEAN_DEFENSE_APPROVAL" && (document.versions || []).some((version: any) => version.status === "ACTIVE" && version.signedSignature && !version.signedSignature.revokedAt));
    return [
      { label: "Required workflow milestones completed", done: Boolean(project?.workflowInstance?.completedAt) },
      { label: "Faculty adviser assigned", done: hasAdviser },
      { label: "Final manuscript or required submission approved", done: hasFinalManuscript },
      { label: "Dean-signed defense approval received", done: hasSignedDeanApproval },
    ];
  }, [data, project]);

  const setSection = (section: WorkspaceSection) => {
    router.replace(`/adviser/advisees/${researchId}${section === "overview" ? "" : `?section=${section}`}`);
  };

  const openVersion = async (version: any, download: boolean) => {
    const actionKey = `${version.id}:${download ? "download" : "preview"}`;
    setFileAction(actionKey);
    setFileError(null);
    try {
      const blob = await apiClient.file(`/api/documents/versions/${version.id}/content${download ? "?download=1" : ""}`);
      const objectUrl = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = version.fileName || "research-document";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      setFileError(error?.message || "The document could not be opened.");
    } finally {
      setFileAction(null);
    }
  };

  if (workspaceQuery.isPending) return <WorkspaceSkeleton />;

  if (workspaceQuery.isError || !project) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <EmptyState
          size="lg"
          icon={AlertCircle}
          title="Research group unavailable"
          description={(workspaceQuery.error as any)?.message || "This project does not exist or is outside your assigned adviser scope."}
          action={<div className="flex flex-wrap justify-center gap-2"><Link href="/adviser/dashboard?tab=advisees" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4" />Back to My Advisees</Link><Button variant="outline" onClick={() => workspaceQuery.refetch()} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button></div>}
        />
      </div>
    );
  }

  if (!hasWorkspaceAccess) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <EmptyState size="lg" icon={ShieldCheck} title="Adviser access required" description="Only the currently assigned adviser can open this research supervision workspace." action={<Link href="/adviser/dashboard?tab=advisees" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4" />Back to My Advisees</Link>} />
      </div>
    );
  }

  const groupName = project.groupName || `${fullName(studentMembers.find((member: any) => member.projectRole === "LEADER")?.user)}'s Group`;
  const activeStatus = readable(project.status, "Active");

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 text-[var(--color-text-primary)]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
        <Link href="/adviser/dashboard?tab=advisees" className="inline-flex items-center gap-1.5 hover:text-[var(--color-primary)]"><ArrowLeft className="h-3.5 w-3.5" />My Advisees</Link>
        <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        <span className="max-w-[50vw] truncate text-[var(--color-text-primary)]" aria-current="page">{groupName}</span>
      </nav>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B3A53] via-[#0E4968] to-[#072A3D] p-5 text-white shadow-lg sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#C9A227]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100">{activeStatus}</span>
                <span className="text-xs font-semibold text-[#E4C864]">{groupName}</span>
              </div>
              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.1rem]">{project.title}</h1>
              <p className="mt-2 line-clamp-2 max-w-3xl text-base leading-6 text-white/75">{project.abstract || "No research abstract has been provided."}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href={`/adviser/reviews`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"><MessageSquareText className="h-4 w-4" />Global reviews</Link>
              <Link href={`/adviser/dashboard?tab=consultations&researchId=${researchId}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#C9A227] px-3.5 text-sm font-bold text-[#072A3D] transition hover:bg-[#E4C864]"><CalendarClock className="h-4 w-4" />Group consultation</Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              { label: "Current stage", value: currentStage, icon: ClipboardCheck },
              { label: "Progress", value: `${progress}%`, icon: Activity },
              { label: "Group members", value: studentMembers.length, icon: Users },
              { label: "Pending tasks", value: pendingTaskCount, icon: Clock3 },
            ].map((metric) => <div key={metric.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><metric.icon className="h-4 w-4 text-[#E4C864]" /></span><span className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wider text-white/60">{metric.label}</span><span className="mt-0.5 block truncate text-base font-bold text-white" title={String(metric.value)}>{metric.value}</span></span></div>)}
          </div>
        </div>
      </header>

      <nav aria-label="Research workspace sections" className="sticky top-16 z-20 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1.5 shadow-[var(--shadow-card-soft)] backdrop-blur">
        <div className="flex min-w-max gap-1" role="tablist">
          {SECTION_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = activeSection === item.id;
            return <button key={item.id} type="button" role="tab" aria-selected={selected} aria-controls={`workspace-panel-${item.id}`} onClick={() => setSection(item.id)} className={cn("inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] sm:text-sm", selected ? "bg-[var(--color-primary)] text-[var(--college-on-primary)] shadow-xs dark:text-[var(--college-on-primary-dark)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)]")}><Icon className="h-4 w-4" />{item.label}</button>;
          })}
        </div>
      </nav>

      <main id={`workspace-panel-${activeSection}`} role="tabpanel" className="min-h-[420px]" tabIndex={-1}>
        {activeSection === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <MetricCard icon={GraduationCap} label="Academic year" value={project.academicYear?.name || project.academicYear?.label || "Not assigned"} detail={project.program?.name} />
              <MetricCard icon={FileText} label="Documents" value={data.documents.length} detail={`${data.documents.reduce((sum, document) => sum + (document.versions?.length || 0), 0)} saved versions`} />
              <MetricCard icon={CalendarClock} label="Consultations" value={data.consultations.length} detail={`${data.consultations.filter((item) => ["requested", "scheduled"].includes(String(item.status).toLowerCase())).length} upcoming or pending`} />
              <MetricCard icon={MessageSquareText} label="Review records" value={reviewItems.length} detail={`${reviewItems.filter((item: any) => item.assignment?.status === "ACTIVE").length} active requests`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.72fr)]">
              <SectionCard title="Recent project activity" description="The latest recorded academic actions for this research group." action={<button type="button" onClick={() => setSection("activity")} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></button>}>
                <ActivityList items={data.activity} limit={5} />
              </SectionCard>
              <div className="space-y-4">
                <SectionCard title="Upcoming deadlines" description="The nearest recorded project dates, in chronological order." action={upcomingDeadlines.length > 4 ? <button type="button" aria-expanded={showAllDeadlines} onClick={() => setShowAllDeadlines((current) => !current)} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] hover:underline">{showAllDeadlines ? "Show nearest" : `View all (${upcomingDeadlines.length})`} <ArrowRight className={cn("h-3.5 w-3.5 transition-transform", showAllDeadlines && "rotate-90")} /></button> : undefined}>
                  {upcomingDeadlines.length ? <div className="space-y-2">{(showAllDeadlines ? upcomingDeadlines : upcomingDeadlines.slice(0, 4)).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]"><CalendarClock className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.label}</span><span className="block text-xs leading-4 text-[var(--color-text-secondary)]">{item.detail} · {formatDateTime(item.date)}</span></span></div>)}</div> : <EmptyState size="sm" icon={CalendarClock} title="No upcoming deadlines" description="No future milestone, consultation, or defense date is currently recorded." />}
                </SectionCard>
                <SectionCard title="Group members" description={`${studentMembers.length} active student ${studentMembers.length === 1 ? "member" : "members"}.`}>
                  <div className="space-y-2">{studentMembers.map((member: any) => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--college-on-primary)]">{`${member.user?.firstName?.[0] || "S"}${member.user?.lastName?.[0] || ""}`}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{fullName(member.user)}</span><span className="block truncate text-xs text-[var(--color-text-secondary)]">{member.projectRole === "LEADER" ? "Group leader" : "Researcher"}</span></span></div>)}</div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {activeSection === "documents" && (
          <SectionCard title="Research documents" description="Manuscripts and supporting academic records already stored for this project." action={<Tag variant={data.documentPermissions.canReview ? "success" : "neutral"} icon={<ShieldCheck className="h-3.5 w-3.5" />}>{data.documentPermissions.canReview ? "Review access" : "View access"}</Tag>}>
            {fileError && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{fileError}</div>}
            {data.documents.length ? <div className="space-y-3">{data.documents.map((document) => {
              const latest = document.versions?.[0];
              return <article key={document.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]"><FileText className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-text-primary)]">{document.title}</h3><Tag size="xs" variant={statusVariant(document.lifecycleStatus)}>{readable(document.lifecycleStatus)}</Tag></div><p className="mt-1 text-base text-[var(--color-text-secondary)]">{readable(document.documentType)}{document.milestone?.name ? ` · ${document.milestone.name}` : ""}</p><p className="mt-1 text-base text-[var(--color-text-muted)]">{latest ? `Version ${latest.versionNumber} · ${latest.fileName} · updated ${formatDate(latest.uploadedAt)}` : "No stored version"}</p></div></div>{latest && <div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" isLoading={fileAction === `${latest.id}:preview`} onClick={() => openVersion(latest, false)} icon={<Eye className="h-4 w-4" />}>Preview</Button><Button size="sm" variant="secondary" isLoading={fileAction === `${latest.id}:download`} onClick={() => openVersion(latest, true)} icon={<Download className="h-4 w-4" />}>Download</Button>{document.liveDocumentUrl && <a href={document.liveDocumentUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-semibold text-[var(--color-primary)]"><ExternalLink className="h-4 w-4" />Live document</a>}</div>}</div>{document.versions?.length > 0 && <details className="mt-4 border-t border-[var(--color-border)] pt-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)]">Version history ({document.versions.length})</summary><div className="mt-3 space-y-2">{document.versions.map((version: any) => <div key={version.id} className="flex flex-col gap-2 rounded-xl bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-semibold text-[var(--color-text-primary)]">Version {version.versionNumber} · {version.fileName}</p><p className="mt-1 text-base text-[var(--color-text-secondary)]">{readable(version.manuscriptStatus || version.status)} · uploaded {formatDateTime(version.uploadedAt)}{version.submitter ? ` by ${fullName(version.submitter)}` : ""}</p></div><div className="flex gap-1"><button type="button" onClick={() => openVersion(version, false)} disabled={Boolean(fileAction)} className="rounded-lg p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50" aria-label={`Preview version ${version.versionNumber}`}><Eye className="h-4 w-4" /></button><button type="button" onClick={() => openVersion(version, true)} disabled={Boolean(fileAction)} className="rounded-lg p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50" aria-label={`Download version ${version.versionNumber}`}><Download className="h-4 w-4" /></button></div></div>)}</div></details>}</article>;
            })}</div> : <EmptyState icon={FileText} title="No research documents" description="This group has not created or submitted a manuscript in the document workspace yet." />}
          </SectionCard>
        )}

        {activeSection === "milestones" && (
          <SectionCard title="Research milestones" description="Workflow stages and requirement-level progress from the assigned academic workflow." action={<Tag variant="primary">{progress}% complete</Tag>}>
            {data.milestones.length ? <ol className="space-y-3">{data.milestones.map((milestone, index) => <li key={milestone.id} className={cn("rounded-2xl border p-4 sm:p-5", milestone.isCurrent ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]/40" : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]")}><div className="flex items-start gap-3"><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-black", milestone.completed ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : milestone.isCurrent ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--college-on-primary)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]")}>{milestone.completed ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-text-primary)]">{milestone.name}</h3>{milestone.isCurrent && <Tag size="xs" variant="primary">Current</Tag>}<Tag size="xs" variant={statusVariant(milestone.status)}>{readable(milestone.status)}</Tag></div>{milestone.description && <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">{milestone.description}</p>}<div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-muted)] dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#0B3A53] to-[#C9A227]" style={{ width: `${milestone.completionPercent || 0}%` }} /></div><span className="text-xs font-bold text-[var(--color-primary)]">{milestone.completedRequirements}/{milestone.totalRequirements}</span></div>{milestone.tasks?.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{milestone.tasks.map((task: any) => <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><div><p className="text-base font-semibold text-[var(--color-text-primary)]">{task.title}</p><p className="mt-1 text-base text-[var(--color-text-muted)]">{task.attempts?.length || 0} submission {task.attempts?.length === 1 ? "attempt" : "attempts"}</p></div><Tag size="xs" variant={statusVariant(task.status)}>{readable(task.status, "Not submitted")}</Tag></div>)}</div>}</div></div></li>)}</ol> : <EmptyState icon={ClipboardCheck} title="No workflow milestones" description="No academic workflow has been assigned to this research project." />}
          </SectionCard>
        )}

        {activeSection === "consultations" && (
          <SectionCard scopeLabel="This research group" title="Project consultations" description="Schedules, notes, feedback, and action items recorded for this project only." action={<Link href={`/adviser/dashboard?tab=consultations&researchId=${researchId}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 text-sm font-semibold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]"><CalendarClock className="h-4 w-4" />Open global consultations</Link>}>
            {data.consultations.length ? <div className="space-y-3">{[...data.consultations].sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()).map((consultation) => <article key={consultation.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-text-primary)]">{consultation.topic || consultation.title}</h3><Tag size="xs" variant={statusVariant(consultation.status)}>{readable(consultation.status)}</Tag></div><p className="mt-2 text-base text-[var(--color-text-secondary)]">{formatDateTime(consultation.scheduledStart)} · {consultation.mode || "Consultation"}</p>{consultation.description && <p className="mt-2 text-base leading-5 text-[var(--color-text-secondary)]">{consultation.description}</p>}</div>{consultation.meetingUrl && <a href={consultation.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-semibold text-[var(--color-primary)]"><ExternalLink className="h-4 w-4" />Open meeting</a>}</div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-xl bg-[var(--color-surface)] p-3"><p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Latest notes</p><p className="mt-2 whitespace-pre-wrap text-base leading-5 text-[var(--color-text-secondary)]">{consultation.notes || "No consultation notes have been recorded."}</p></div><div className="rounded-xl bg-[var(--color-surface)] p-3"><p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Action items</p>{consultation.actionItems?.length ? <ul className="mt-2 space-y-1.5">{consultation.actionItems.map((item: any, index: number) => <li key={index} className="flex gap-2 text-xs leading-5 text-[var(--color-text-secondary)]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />{typeof item === "string" ? item : item.text || item.title || JSON.stringify(item)}</li>)}</ul> : <p className="mt-2 text-base text-[var(--color-text-secondary)]">No action items have been recorded.</p>}</div></div></article>)}</div> : <EmptyState icon={CalendarClock} title="No consultations recorded" description="Schedule the first project consultation from the existing adviser consultation workspace." action={<Link href={`/adviser/dashboard?tab=consultations&researchId=${researchId}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 text-sm font-semibold text-white">Schedule consultation</Link>} />}
          </SectionCard>
        )}

        {activeSection === "reviews" && (
          <SectionCard scopeLabel="This research group" title="Project reviews & feedback" description="Reviewer assignments, decisions, comments, and revision statuses for this project's document versions." action={<Link href="/adviser/reviews" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] hover:underline">Open global review center <ArrowRight className="h-3.5 w-3.5" /></Link>}>
            {reviewItems.length ? <div className="space-y-3">{reviewItems.map((item: any, index: number) => {
              const review = item.assignment?.review || item.review;
              const assignment = item.assignment;
              const comments = review?.comments || [];
              return <article key={assignment?.id || review?.id || index} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--color-text-primary)]">{item.document.title} · Version {item.version.versionNumber}</h3><Tag size="xs" variant={statusVariant(assignment?.status || review?.status)}>{readable(assignment?.status || review?.status, "Recorded")}</Tag>{review?.recommendation && <Tag size="xs" variant={statusVariant(review.recommendation)}>{readable(review.recommendation)}</Tag>}</div><p className="mt-1 text-base text-[var(--color-text-secondary)]">{assignment ? `${readable(assignment.reviewType)} review · assigned ${formatDate(assignment.assignedAt)}` : `${readable(review?.reviewType)} review · ${formatDate(review?.submittedAt || review?.createdAt)}`}</p>{review?.reviewer && <p className="mt-1 text-base text-[var(--color-text-muted)]">Reviewer: {fullName(review.reviewer)}</p>}</div>{assignment?.status === "ACTIVE" && assignment.reviewerId === user?.id && <Link href={`/adviser/reviews?projectId=${researchId}&documentId=${item.document.id}&versionId=${item.version.id}&assignmentId=${assignment.id}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 text-sm font-semibold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]">Continue review <ArrowRight className="h-4 w-4" /></Link>}</div>{review?.overallComment && <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Overall feedback</p><p className="mt-2 whitespace-pre-wrap text-base leading-5 text-[var(--color-text-secondary)]">{review.overallComment}</p></div>}{comments.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)]">Comments ({comments.length})</summary><div className="mt-2 space-y-2">{comments.map((comment: any) => <div key={comment.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-base font-semibold text-[var(--color-text-primary)]">{fullName(comment.author)}</p><Tag size="xs" variant={comment.status === "RESOLVED" ? "success" : "warning"}>{readable(comment.status)}</Tag></div><p className="mt-2 text-base leading-5 text-[var(--color-text-secondary)]">{comment.comment}</p></div>)}</div></details>}</article>;
            })}</div> : <EmptyState icon={MessageSquareText} title="No review history" description="Reviewer requests, faculty comments, and revision decisions will appear here when recorded." />}
          </SectionCard>
        )}

        {activeSection === "defense" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <SectionCard title="Defense schedule" description="Defense information visible to this account under the existing defense permissions.">
              {data.defenseSessions.length ? <div className="space-y-3">{data.defenseSessions.map((session) => <article key={session.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="font-semibold text-[var(--color-text-primary)]">{session.defenseEvent?.code || "Research defense"}</h3><Tag size="xs" variant={statusVariant(session.status)}>{readable(session.status)}</Tag></div>{session.queuePosition && <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Queue {session.queuePosition}</span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="flex gap-2 text-xs text-[var(--color-text-secondary)]"><CalendarClock className="h-4 w-4 shrink-0 text-[var(--color-primary)]" /><span>{formatDateTime(session.scheduledStart)}</span></div><div className="flex gap-2 text-xs text-[var(--color-text-secondary)]"><MapPin className="h-4 w-4 shrink-0 text-[var(--color-primary)]" /><span>{session.venue || session.defenseEvent?.venue || "Venue not assigned"}</span></div></div><div className="mt-4 border-t border-[var(--color-border)] pt-4"><p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Invited panel</p>{session.invitations?.length ? <div className="mt-2 flex flex-wrap gap-2">{session.invitations.map((invitation: any) => <span key={invitation.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"><UserRoundCheck className="h-3.5 w-3.5 text-[var(--color-primary)]" />{fullName(invitation.invitee)} · {readable(invitation.role)} · {readable(invitation.status)}</span>)}</div> : <p className="mt-2 text-base text-[var(--color-text-secondary)]">No panel invitations are visible to this account.</p>}</div>{session.notes && <p className="mt-4 rounded-xl bg-[var(--color-surface)] p-3 text-base leading-5 text-[var(--color-text-secondary)]">{session.notes}</p>}</article>)}</div> : <EmptyState icon={ShieldCheck} title="No authorized defense schedule" description="No defense session is currently visible to this adviser under the existing invitation and role permissions." />}
            </SectionCard>
            <SectionCard title="Defense readiness" description="Requirements derived from the project's existing workflow and documents.">
              <div className="space-y-2">{defenseRequirements.map((requirement) => <div key={requirement.label} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3"><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", requirement.done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300")}>{requirement.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-base font-semibold text-[var(--color-text-primary)]">{requirement.label}</p><p className="mt-0.5 text-base text-[var(--color-text-secondary)]">{requirement.done ? "Requirement recorded" : "Still required"}</p></div></div>)}</div>
            </SectionCard>
          </div>
        )}

        {activeSection === "activity" && (
          <SectionCard title="Project activity" description="Academic activity recorded specifically for this research project." action={<Tag variant="neutral" icon={<History className="h-3.5 w-3.5" />}>{data.activity.length} records</Tag>}>
            <ActivityList items={data.activity} />
          </SectionCard>
        )}
      </main>

    </div>
  );
}
