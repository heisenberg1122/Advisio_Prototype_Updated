import React, { useState, Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import {
  CardsPageSkeleton,
  DashboardSkeleton,
  ListPageSkeleton,
  TablePageSkeleton,
} from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { calendarDaysUntil } from "@/lib/researcher-home";
import { CardLink, CountStrip, DateTile, EmptyNote, ListRow, PageBand, RowIcon, SectionCard, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { Button } from "@/components/ui/Button";
import "./panelist-home.css";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { PanelistReviewPackets } from "@/components/panelist/PanelistReviewPackets";
import { PdfEvaluationWorkspace } from "@/components/panelist/PdfEvaluationWorkspace";
import { StructuredEvaluationWorkspace } from "@/components/panelist/StructuredEvaluationWorkspace";
import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";
import { deanDefenseReturn } from "@/lib/dean-defense-navigation";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";

const TZ = "Asia/Manila";
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: TZ,
      }).format(new Date(value))
    : "Pending";
const formatTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: TZ,
      }).format(new Date(value))
    : "Awaiting schedule";
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TZ,
      }).format(new Date(value))
    : "Not recorded";
const readable = (value?: string | null, fallback = "Not recorded") =>
  value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;
const attendanceMode = (session: any) => {
  const venue = session.venue || session.defenseEvent?.venue;
  const meetingUrl = session.meetingUrl || session.defenseEvent?.meetingUrl;
  if (venue && meetingUrl) return "Hybrid";
  if (meetingUrl) return "Online";
  if (venue) return "On-site";
  return "To be announced";
};

function PanelistDashboardContent() {
  const searchParams = useSearchParams();
  const { switchDashboard, registerDirtyForm } = useDashboardWorkspace();
  const activeTab = searchParams.get("tab") || "overview";
  const requestedSessionId = searchParams.get("sessionId") || "";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useQuery<any>({
    queryKey: ["panelist-dashboard-summary"],
    queryFn: () => apiClient.get("/api/panelist/dashboard-summary"),
    refetchInterval: 15000,
  });

  const {
    data: liveData,
    isLoading: liveLoading,
    error: liveError,
  } = useQuery({
    queryKey: ["active-defense-session", requestedSessionId],
    queryFn: () =>
      apiClient.get<{ session: any | null }>("/api/defense-sessions/active", {
        params: requestedSessionId
          ? { sessionId: requestedSessionId }
          : undefined,
      }),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
  const liveSession = liveData?.session || null;
  const { data: templateData } = useQuery({
    queryKey: ["evaluation-templates", liveSession?.research?.researchTypeId],
    queryFn: () =>
      apiClient.get<{ templates: any[] }>("/api/evaluation-templates", {
        params: { researchTypeId: liveSession.research.researchTypeId },
      }),
    enabled: Boolean(liveSession?.research?.researchTypeId),
  });
  const activeTemplate =
    liveSession?.evaluations?.[0]?.template ||
    templateData?.templates?.[0] ||
    null;

  const assignedProjects = dashboardData?.assignedProjects || [];
  const documents = dashboardData?.pendingReviews || [];
  const evaluations = dashboardData?.pendingEvaluations || [];
  const archives = dashboardData?.archives || [];
  const completedPdfEvaluations = dashboardData?.completedPdfEvaluations || [];
  const completedStructuredEvaluations =
    dashboardData?.completedStructuredEvaluations || [];
  const evaluationSession = requestedSessionId
    ? liveSession?.id === requestedSessionId
      ? liveSession
      : dashboardData?.sessions?.find(
          (item: any) => item.id === requestedSessionId,
        )
    : liveSession;
  const pdfEvaluationSession =
    evaluationSession?.packet?.evaluationMode === "PDF"
      ? evaluationSession
      : null;
  const gradesSubmitted = useMemo(
    () =>
      (dashboardData?.completedEvaluations || []).map((session: any) => ({
        id: session.evaluations[0].id,
        sessionId: session.id,
        title: session.research.title,
        score: Number(session.evaluations[0].totalScore),
        maximum: Number(session.evaluations[0].template?.totalScore || 0),
        recommendation: session.evaluations[0].recommendation,
        lockedAt: session.evaluations[0].lockedAt,
        status: "locked",
      })),
    [dashboardData?.completedEvaluations],
  );
  const schedules = useMemo(
    () =>
      (dashboardData?.sessions || []).map((session: any) => ({
        ...session,
        title: session.research?.title,
        date: formatDate(session.scheduledStart),
        time: formatTime(session.scheduledStart),
        venue:
          session.venue ||
          session.defenseEvent?.venue ||
          (session.meetingUrl || session.defenseEvent?.meetingUrl
            ? "Online"
            : "To be announced"),
        type: readable(session.status),
        myInvitation: session.invitations?.[0] || null,
      })),
    [dashboardData?.sessions],
  );
  const upcomingSchedules = useMemo(
    () =>
      schedules.filter((session: any) =>
        dashboardData?.upcomingSessions?.some(
          (item: any) => item.id === session.id,
        ),
      ),
    [schedules, dashboardData?.upcomingSessions],
  );

  const [criterionScores, setCriterionScores] = useState<
    Record<string, number | "">
  >({});
  const [criterionComments, setCriterionComments] = useState<
    Record<string, string>
  >({});
  const [activeRecommendation, setActiveRecommendation] = useState("APPROVE");
  const [activeRemarks, setActiveRemarks] = useState("");
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationDirty, setEvaluationDirty] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [respondingInvitation, setRespondingInvitation] = useState<any | null>(
    null,
  );
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [suggestedAvailability, setSuggestedAvailability] = useState("");
  const [invitationSaving, setInvitationSaving] = useState(false);

  useEffect(() => {
    const existing = liveSession?.evaluations?.[0];
    const stored = Array.isArray(existing?.criteriaScores)
      ? existing.criteriaScores
      : [];
    if (activeTemplate?.criteria) {
      setCriterionScores(
        Object.fromEntries(
          activeTemplate.criteria.map((criterion: any) => [
            criterion.id,
            stored.find((item: any) => item.criterionId === criterion.id)
              ?.score ?? "",
          ]),
        ),
      );
      setCriterionComments(
        Object.fromEntries(
          activeTemplate.criteria.map((criterion: any) => [
            criterion.id,
            stored.find((item: any) => item.criterionId === criterion.id)
              ?.comment ?? "",
          ]),
        ),
      );
    }
    setActiveRecommendation(existing?.recommendation || "APPROVE");
    setActiveRemarks(existing?.remarks || "");
    setEvaluationDirty(false);
  }, [liveSession?.id, liveSession?.evaluations?.[0]?.id, activeTemplate?.id]);

  useEffect(() => {
    if (!evaluationDirty) return;
    return registerDirtyForm({ id: "panelist-legacy-evaluation", isDirty: () => true });
  }, [evaluationDirty, registerDirtyForm]);

  useEffect(() => {
    if (!evaluationDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [evaluationDirty]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const respondToInvitation = async (
    invitation: any,
    response: "ACCEPTED" | "DECLINED",
  ) => {
    if (response === "DECLINED" && !declineReason.trim()) {
      triggerToast("Please provide a reason before declining.");
      return;
    }
    setInvitationSaving(true);
    try {
      await apiClient.patch(
        `/api/defense-management/invitations/${invitation.id}/respond`,
        {
          response,
          responseNote: declineReason,
          suggestedAvailability: suggestedAvailability
            ? [new Date(suggestedAvailability).toISOString()]
            : [],
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["panelist-dashboard-summary"],
      });
      setRespondingInvitation(null);
      setDeclineReason("");
      setSuggestedAvailability("");
      triggerToast(
        response === "ACCEPTED"
          ? "Defense invitation accepted."
          : "Your unavailability was sent to the professor.",
      );
    } catch (error: any) {
      triggerToast(error?.message || "Your response could not be saved.");
    } finally {
      setInvitationSaving(false);
    }
  };

  const handleSaveEvaluation = async (final: boolean) => {
    if (!liveSession || !activeTemplate) return;
    if (
      final &&
      activeTemplate.criteria.some(
        (criterion: any) =>
          criterionScores[criterion.id] === "" ||
          criterionScores[criterion.id] === undefined,
      )
    ) {
      setEvaluationError(
        "Enter an explicit score for every rubric criterion before final submission. A score of zero is allowed.",
      );
      return;
    }
    setEvaluationError(null);
    setIsSavingEvaluation(true);
    try {
      const result = await apiClient.put<any>(
        `/api/defense-sessions/${liveSession.id}/evaluation`,
        {
          templateId: activeTemplate.id,
          recommendation: activeRecommendation,
          remarks: activeRemarks,
          final,
          criteriaScores: activeTemplate.criteria.map((criterion: any) => ({
            criterionId: criterion.id,
            score: criterionScores[criterion.id],
            comment: criterionComments[criterion.id] || "",
          })),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["active-defense-session"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["panelist-dashboard-summary"],
      });
      setEvaluationDirty(false);
      triggerToast(
        final
          ? "Final evaluation submitted and locked."
          : "Evaluation draft saved securely.",
      );
      if (final && result.generatedVersion?.googleDriveFileId) {
        setSigningDocument({
          versionId: result.generatedVersion.id,
          docName: "Panelist Evaluation",
          groupName: liveSession.research.title,
          fileUrl: `/api/documents/files/${result.generatedVersion.googleDriveFileId}`,
        });
      }
    } catch (error: any) {
      setEvaluationError(
        error?.message || "The evaluation could not be saved.",
      );
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
    if (
      evaluationDirty &&
      activeTab === "evaluation" &&
      !window.confirm(
        "You have unsaved evaluation changes. Leave without saving them?",
      )
    )
      return;
    router.push(`/panelist/dashboard?tab=${tab}`);
  };

  if ((dashboardLoading || liveLoading) && activeTab !== "messages") {
    if (activeTab === "overview") return <DashboardSkeleton />;
    if (activeTab === "schedule") return <CardsPageSkeleton />;
    if (activeTab === "history") return <ListPageSkeleton />;
    return <TablePageSkeleton />;
  }

  return (
    <>
      {signingDocument && (
        <DocumentSigningModal
          document={signingDocument}
          onClose={() => setSigningDocument(null)}
          onSigned={(message) => {
            setSigningDocument(null);
            triggerToast(message);
            queryClient.invalidateQueries({
              queryKey: ["active-defense-session"],
            });
          }}
        />
      )}

      <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
        {toast && (
          <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border border-white/10 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <i className="ti ti-circle-check text-[#ffa400] text-lg" />
            <span className="text-[12px] font-bold">{toast}</span>
          </div>
        )}

        {respondingInvitation && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-defense-title"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wider text-rose-600">
                    Availability response
                  </p>
                  <h2
                    id="decline-defense-title"
                    className="mt-1 text-xl font-extrabold text-[#102f49]"
                  >
                    Cannot attend this schedule?
                  </h2>
                  <p className="mt-1 text-base text-slate-500">
                    Your reason is shared with the professor, not the research
                    group.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRespondingInvitation(null)}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <label className="mt-5 block text-sm font-bold text-slate-700">
                Reason
                <textarea
                  required
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  rows={4}
                  placeholder="Explain why you are unavailable…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-base font-normal"
                />
              </label>
              <label className="mt-4 block text-sm font-bold text-slate-700">
                Suggested alternative{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <input
                  type="datetime-local"
                  value={suggestedAvailability}
                  onChange={(event) =>
                    setSuggestedAvailability(event.target.value)
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-base font-normal"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRespondingInvitation(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Keep invitation
                </button>
                <button
                  type="button"
                  onClick={() =>
                    respondToInvitation(respondingInvitation, "DECLINED")
                  }
                  disabled={invitationSaving || !declineReason.trim()}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  Decline and notify professor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTAINER */}
        <div
          className={`workspace-page flex w-full flex-1 flex-col space-y-6 ${activeTab === "messages" ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1540px] p-4 sm:p-6 lg:p-8"}`}
        >
          {activeTab === "evaluation" && deanDefenseReturn(searchParams.get("returnTo"), user?.roles) && (
            <button className="w-fit text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]" onClick={() => {
              if (evaluationDirty && !window.confirm("You have unsaved evaluation changes. Leave without saving them?")) return;
              const destination = deanDefenseReturn(searchParams.get("returnTo"), user?.roles);
              if (destination) void switchDashboard("dean", { destination });
            }}>← Back to Dean Defenses</button>
          )}
          {dashboardError && activeTab !== "messages" && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              Panel assignments could not be loaded. Counts and assignments are
              unavailable; refresh to try again.
            </div>
          )}

          {(() => {
            const tabContent: Record<string, React.ReactNode> = {
              messages: <FacultyGroupChats triggerToast={triggerToast} />,
              overview: (
                <div data-guide="panelist-overview" className="pe">
                  {(() => {
                    const now = Date.now();
                    const today = new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });
                    const timeOf = (value?: string | null) =>
                      value ? new Date(value).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "";
                    const dayLabel = (value: Date) => {
                      const offset = calendarDaysUntil(value, now);
                      if (offset === 0) return "Today";
                      if (offset === 1) return "Tomorrow";
                      return value.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
                    };
                    const submittedCount = gradesSubmitted.length + completedPdfEvaluations.length;
                    const liveId = liveSession?.status === "LIVE" ? liveSession.id : null;
                    const defenses = [
                      ...(liveId && !upcomingSchedules.some((item: any) => item.id === liveId) ? [{ ...liveSession, title: liveSession.research?.title }] : []),
                      ...upcomingSchedules,
                    ].sort((a: any, b: any) => new Date(a.scheduledStart || 0).getTime() - new Date(b.scheduledStart || 0).getTime());
                    const projectStatus = (project: any): { tone: StatusTone; label: string } => {
                      if (String(project.defenseStatus || "").toUpperCase() === "LIVE") return { tone: "live", label: "Live now" };
                      const status = String(project.status || "").toUpperCase();
                      if (status === "APPROVED") return { tone: "done", label: "Approved" };
                      if (status === "COMPLETED") return { tone: "neutral", label: "Completed" };
                      if (status === "DEFENSE" || status === "SCHEDULED") return { tone: "brand", label: "Scheduled" };
                      return { tone: "brand", label: readable(project.status, "Active") };
                    };
                    const nextDefense = defenses[0];
                    const nextStart = nextDefense?.scheduledStart ? new Date(nextDefense.scheduledStart) : null;
                    const summary = [
                      evaluations.length
                        ? `${evaluations.length} ${evaluations.length === 1 ? "evaluation" : "evaluations"} waiting for your score`
                        : "Nothing waiting for your score",
                      documents.length ? `${documents.length} ${documents.length === 1 ? "manuscript" : "manuscripts"} to review` : null,
                      nextDefense
                        ? nextDefense.status === "LIVE"
                          ? "a defense is live now"
                          : nextStart
                            ? `next defense ${dayLabel(nextStart) === "Today" || dayLabel(nextStart) === "Tomorrow" ? dayLabel(nextStart).toLowerCase() : dayLabel(nextStart)}, ${timeOf(nextDefense.scheduledStart)}`
                            : null
                        : null,
                    ].filter(Boolean).join(" · ");
                    const firstEvaluation = evaluations.find((item: any) => item.status === "LIVE" || item.id === liveId) || evaluations[0];
                    const openEvaluation = (sessionId?: string) =>
                      sessionId ? router.push(`/panelist/dashboard?tab=evaluation&sessionId=${sessionId}`) : handleTabChange("evaluation");
                    const submittedActivity = [
                      ...gradesSubmitted.map((item: any) => ({ id: `grade-${item.id}`, sessionId: item.sessionId, title: item.title, meta: `Score ${item.score}${item.maximum ? ` / ${item.maximum}` : ""} · ${readable(item.recommendation, "No recommendation")}`, at: item.lockedAt })),
                      ...completedStructuredEvaluations.map((session: any) => ({ id: `structured-${session.id}`, sessionId: session.id, title: session.research?.title, meta: "Digital evaluation submitted", at: session.structuredEvaluations?.[0]?.lockedAt || session.endedAt })),
                      ...completedPdfEvaluations.map((session: any) => ({ id: `pdf-${session.id}`, sessionId: session.id, title: session.research?.title, meta: "PDF evaluation submitted", at: session.pdfEvaluations?.[0]?.lockedAt || session.endedAt })),
                    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
                    const manuscriptRows = documents.slice(0, 4);
                    const submittedRows = submittedActivity.slice(0, Math.max(0, 4 - manuscriptRows.length));
                    const quickActions = [
                      { icon: "ti-calendar-event", label: "View schedule", hint: "Defense dates and invitations", onClick: () => handleTabChange("schedule") },
                      { icon: "ti-file-search", label: "Review documents", hint: "Manuscripts for your panels", onClick: () => handleTabChange("documents") },
                      { icon: "ti-clipboard-check", label: "Score defense", hint: "Open your score sheet", onClick: () => openEvaluation(firstEvaluation?.id) },
                      { icon: "ti-award", label: "View results", hint: "Submitted scores and decisions", onClick: () => handleTabChange("grades") },
                    ];
                    return (
                      <>
                        <PageBand
                          variant="home"
                          className="pe-band"
                          titleId="pe-greeting"
                          eyebrow={`${today} · Panelist`}
                          title={`Good day, ${user?.firstName || "Panelist"}`}
                          meta={summary}
                          counts={
                            <CountStrip
                              label="Your evaluation work"
                              items={[
                                { label: "Assigned", value: assignedProjects.length, onClick: () => handleTabChange("documents") },
                                { label: "To evaluate", value: evaluations.length, tone: evaluations.length ? "waiting" : undefined, onClick: () => handleTabChange("evaluation") },
                                { label: "Upcoming", value: upcomingSchedules.length, onClick: () => handleTabChange("schedule") },
                                { label: "Submitted", value: submittedCount, onClick: () => handleTabChange("grades") },
                              ]}
                            />
                          }
                          footer={
                            <>
                              <Button size="sm" variant="secondary" icon={<i className="ti ti-clipboard-check" aria-hidden="true" />} onClick={() => openEvaluation(firstEvaluation?.id)}>
                                Start evaluation
                              </Button>
                              <Button size="sm" variant="ghost" className="pe-on-home" icon={<i className="ti ti-file-text" aria-hidden="true" />} onClick={() => handleTabChange("documents")}>
                                Review manuscripts ({documents.length})
                              </Button>
                              <Button size="sm" variant="ghost" className="pe-on-home" icon={<i className="ti ti-calendar-event" aria-hidden="true" />} onClick={() => handleTabChange("schedule")}>
                                Defense schedule
                              </Button>
                            </>
                          }
                        />

                        <div className="pe-row">
                          <SectionCard title="Evaluation queue" titleId="pe-queue" count={evaluations.length} action={<CardLink onClick={() => handleTabChange("grades")}>Results</CardLink>}>
                            <p className="pe-card-sub">Groups waiting for your score</p>
                            {evaluations.length ? (
                              <ul className="au-list">
                                {evaluations.slice(0, 4).map((item: any) => {
                                  const isLive = item.status === "LIVE" || item.id === liveId;
                                  return (
                                    <li key={item.id}>
                                      <ListRow
                                        tone={isLive ? "live" : undefined}
                                        leading={<RowIcon icon="ti-clipboard-check" />}
                                        title={item.research?.title}
                                        titleHint={item.research?.title}
                                        meta={isLive ? `Live now${item.startedAt ? ` · started ${timeOf(item.startedAt)}` : ""}` : [item.defenseEvent?.name, item.research?.groupName].filter(Boolean).join(" · ") || "Waiting for your score"}
                                        end={
                                          <Button size="sm" variant={isLive ? "primary" : "secondary"} onClick={() => openEvaluation(item.id)}>
                                            {isLive ? "Score now" : "Open"}
                                          </Button>
                                        }
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <EmptyNote layout="row" tone="ok" icon="ti-circle-check" title="All caught up" text="No group is waiting for your score." action={<Button size="sm" variant="secondary" onClick={() => handleTabChange("grades")}>View results</Button>} />
                            )}
                          </SectionCard>

                          <SectionCard title="Upcoming defenses" titleId="pe-defenses" action={<CardLink onClick={() => handleTabChange("schedule")}>Schedule</CardLink>}>
                            {defenses.length ? (
                              <ul className="au-list">
                                {defenses.slice(0, 3).map((session: any) => {
                                  const start = session.scheduledStart ? new Date(session.scheduledStart) : null;
                                  const isLive = session.status === "LIVE";
                                  return (
                                    <li key={session.id}>
                                      <ListRow
                                        leading={<DateTile tone={isLive ? "live" : undefined} top={start ? new Date(start).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }) : "TBA"} bottom={start ? new Date(start).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }) : "—"} label={start ? formatDateTime(session.scheduledStart) : "Date to be announced"} />}
                                        title={session.title}
                                        titleHint={session.title}
                                        meta={[isLive ? "Live now" : start ? `${dayLabel(start)}, ${timeOf(session.scheduledStart)}` : null, attendanceMode(session)].filter(Boolean).join(" · ")}
                                        onClick={() => router.push(`/panelist/defenses/${session.id}`)}
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <EmptyNote layout="row" icon="ti-calendar-event" title="No defenses scheduled" text="New panel assignments appear here." />
                            )}
                          </SectionCard>
                        </div>

                        <div className="pe-row">
                          <SectionCard title="Recent evaluation activity" titleId="pe-activity" action={<CardLink onClick={() => handleTabChange("documents")}>All manuscripts</CardLink>}>
                            <p className="pe-card-sub">Manuscripts to review and evaluations you've submitted</p>
                            {manuscriptRows.length || submittedRows.length ? (
                              <ul className="au-list">
                                {manuscriptRows.map((item: any) => {
                                  const started = (item.manuscriptReviews || []).length > 0;
                                  const due = item.scheduledStart ? new Date(item.scheduledStart) : null;
                                  return (
                                    <li key={item.id}>
                                      <ListRow
                                        leading={<RowIcon icon="ti-file-text" />}
                                        title={item.research?.title}
                                        titleHint={item.research?.title}
                                        meta={`Defense documents · ${item.status === "LIVE" ? "defense live now" : due ? `${["Today", "Tomorrow"].includes(dayLabel(due)) ? dayLabel(due).toLowerCase() : dayLabel(due)} ${timeOf(item.scheduledStart)}` : "defense date to be set"}`}
                                        end={<StatusDot tone={started ? "neutral" : "waiting"}>{started ? "Started" : "Not reviewed"}</StatusDot>}
                                        onClick={() => handleTabChange("documents")}
                                      />
                                    </li>
                                  );
                                })}
                                {submittedRows.map((item) => (
                                  <li key={item.id}>
                                    <ListRow
                                      leading={<RowIcon icon="ti-lock-check" />}
                                      title={item.title}
                                      titleHint={item.title}
                                      meta={item.at ? `${item.meta} · ${formatDate(item.at)}` : item.meta}
                                      end={<StatusDot tone="done">Submitted</StatusDot>}
                                      onClick={() => openEvaluation(item.sessionId)}
                                    />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <EmptyNote layout="row" icon="ti-file-check" title="No evaluation activity yet" text="Manuscripts and submitted evaluations appear here." />
                            )}
                          </SectionCard>

                          <SectionCard title="Quick actions" titleId="pe-quick">
                            <ul className="au-list">
                              {quickActions.map((action) => (
                                <li key={action.label}>
                                  <ListRow
                                    leading={<RowIcon icon={action.icon} />}
                                    title={action.label}
                                    meta={action.hint}
                                    end={<i className="ti ti-chevron-right pe-chevron" aria-hidden="true" />}
                                    onClick={action.onClick}
                                  />
                                </li>
                              ))}
                            </ul>
                          </SectionCard>
                        </div>

                        <SectionCard
                          title="Assigned projects"
                          titleId="pe-projects"
                          count={assignedProjects.length}
                          action={<CardLink onClick={() => handleTabChange("documents")}>All manuscripts</CardLink>}
                        >
                          {assignedProjects.length ? (
                            <div className="pe-project-grid">
                              {assignedProjects.map((project: any) => {
                                const status = projectStatus(project);
                                return (
                                  <button key={project.id} type="button" className="au-tile" onClick={() => router.push(`/panelist/defenses/${project.defenseSessionId}`)}>
                                    <span className="au-row-title" title={project.title}>{project.title || "Untitled research project"}</span>
                                    <span className="au-row-meta">{project.workflowInstance?.currentStage?.name || "Research review"}</span>
                                    <StatusDot tone={status.tone}>{status.label}</StatusDot>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <EmptyNote layout="row" icon="ti-flask" title="No assigned projects yet" text="Projects appear here when a defense panel is assigned." />
                          )}
                        </SectionCard>
                      </>
                    );
                  })()}
                </div>
              ),
              schedule: (
                <div data-tour="defense-records" data-guide="panelist-schedule" data-guide-empty={!schedules.length} className="pe">
                  {(() => {
                    const now = Date.now();
                    const timeOf = (value?: string | null) =>
                      value ? new Date(value).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "";
                    const dayLabel = (value: Date) => {
                      const offset = calendarDaysUntil(value, now);
                      if (offset === 0) return "Today";
                      if (offset === 1) return "Tomorrow";
                      return value.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
                    };
                    const submittedIds = new Set<string>([
                      ...completedStructuredEvaluations.map((session: any) => session.id),
                      ...completedPdfEvaluations.map((session: any) => session.id),
                      ...gradesSubmitted.map((grade: any) => grade.sessionId),
                    ]);
                    const needsResponse = (session: any) =>
                      Boolean(session.myInvitation && ["PENDING", "RECONFIRMATION_REQUIRED"].includes(session.myInvitation.status));
                    const isFinished = (session: any) => ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(String(session.status));
                    const byStart = (a: any, b: any) => new Date(a.scheduledStart || 0).getTime() - new Date(b.scheduledStart || 0).getTime();
                    const waiting = schedules.filter(needsResponse).sort(byStart);
                    const upcoming = schedules.filter((session: any) => !needsResponse(session) && !isFinished(session)).sort(byStart);
                    const finished = schedules.filter((session: any) => !needsResponse(session) && isFinished(session)).sort((a: any, b: any) => byStart(b, a));
                    const statusOf = (session: any): { tone: StatusTone; label: string } => {
                      if (session.myInvitation?.status === "DECLINED") return { tone: "attention", label: "You declined" };
                      switch (session.status) {
                        case "LIVE": return { tone: "live", label: "Live" };
                        case "SCHEDULED": return { tone: "done", label: "Confirmed" };
                        case "PENDING_ACKNOWLEDGEMENT": return { tone: "waiting", label: "Tentative" };
                        case "NEEDS_RESCHEDULING": return { tone: "attention", label: "Rescheduling" };
                        case "COMPLETED": return { tone: "neutral", label: "Completed" };
                        default: return { tone: "brand", label: readable(session.status, "Scheduled") };
                      }
                    };
                    const venueOf = (session: any) =>
                      session.venue && session.venue !== "Online" && session.venue !== "To be announced" ? session.venue : null;
                    const roleOf = (session: any) => (session.myInvitation?.role ? readable(session.myInvitation.role) : null);
                    // When every row in a card shares the same room and role, say it once in the card header.
                    const sharedContext = (list: any[]) => {
                      const keys = list.map((session) => [venueOf(session), roleOf(session)].filter(Boolean).join(" · "));
                      return list.length > 1 && keys[0] && keys.every((key) => key === keys[0]) ? keys[0] : null;
                    };
                    const sharedNote = (text: string | null) =>
                      text ? <span className="au-row-meta" data-guide="panelist-invitation">{text}</span> : undefined;
                    const metaOf = (session: any, hideShared: boolean) => {
                      const live = session.status === "LIVE";
                      const when = live
                        ? `Live now${session.startedAt ? ` · started ${timeOf(session.startedAt)}` : ""}`
                        : session.scheduledStart ? timeOf(session.scheduledStart) : "Time to be announced";
                      const note =
                        session.myInvitation?.status === "DECLINED" ? "the professor was notified"
                        : session.status === "SCHEDULED" ? "all panelists confirmed"
                        : session.status === "PENDING_ACKNOWLEDGEMENT" ? "waiting for panel responses"
                        : null;
                      return (
                        <>
                          {[when, attendanceMode(session), hideShared ? null : venueOf(session)].filter(Boolean).join(" · ")}
                          {!hideShared && roleOf(session) && <span data-guide="panelist-invitation"> · {roleOf(session)}</span>}
                          {note && ` · ${note}`}
                        </>
                      );
                    };
                    const dateTile = (session: any, finishedRow = false) => {
                      const start = session.scheduledStart ? new Date(session.scheduledStart) : null;
                      const live = session.status === "LIVE";
                      return (
                        <DateTile
                          tone={live ? "live" : finishedRow ? "muted" : undefined}
                          top={start ? new Date(start).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }) : "TBA"}
                          bottom={start ? new Date(start).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }) : "—"}
                          label={start ? formatDateTime(session.scheduledStart) : "Date to be announced"}
                        />
                      );
                    };
                    const openWorkspace = (session: any, primary = false) => (
                      <Button size="sm" variant={primary ? "primary" : "secondary"} data-guide="panelist-open-session" data-orientation-href={`/panelist/defenses/${session.id}`} onClick={() => router.push(`/panelist/defenses/${session.id}`)}>
                        Open workspace
                      </Button>
                    );
                    const meetingLink = (session: any) => {
                      const url = session.meetingUrl || session.defenseEvent?.meetingUrl;
                      return url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="au-link">
                          <i className="ti ti-video" aria-hidden="true" /> Join meeting
                        </a>
                      ) : null;
                    };
                    const waitingShared = sharedContext(waiting);
                    const upcomingShared = sharedContext(upcoming);
                    const finishedShared = sharedContext(finished);
                    const counts = dashboardData?.counts || {};
                    return (
                      <>
                        <PageBand
                          titleId="ps-title"
                          eyebrow="Panelist · Philippine time"
                          title={
                            <span className="inline-flex items-center gap-2">
                              <i className="ti ti-calendar-event text-[var(--color-primary)]" aria-hidden="true" />
                              Defense schedule
                            </span>
                          }
                          meta="Respond to invitations and open the workspace for each defense you're on."
                          counts={
                            <CountStrip
                              label="Defense schedule summary"
                              items={[
                                { label: "Awaiting response", value: counts.pendingInvitations || 0, tone: counts.pendingInvitations ? "waiting" : undefined },
                                { label: "Confirmed", value: counts.upcomingDefenses || 0 },
                                { label: "Rescheduling", value: counts.rescheduling || 0 },
                                { label: "Completed", value: counts.archivedDefenses || 0 },
                              ]}
                            />
                          }
                        />

                        {!schedules.length ? (
                          <SectionCard title="Your defenses" titleId="ps-empty">
                            <div data-guide="panelist-schedule-empty">
                              <EmptyNote layout="page" icon="ti-calendar-event" title="No defenses assigned yet" text="Defense invitations appear here when a professor adds you to a panel." steps={["A professor invites you to a panel", "You accept the schedule", "You open the defense workspace"]} />
                            </div>
                          </SectionCard>
                        ) : (
                          <>
                            {waiting.length > 0 && (
                              <SectionCard title="Needs your response" titleId="ps-waiting" count={waiting.length} className="ps-attention" action={sharedNote(waitingShared)}>
                                <ul className="au-list">
                                  {waiting.map((session: any) => (
                                    <li key={session.id}>
                                      <ListRow
                                        leading={dateTile(session)}
                                        title={session.title}
                                        titleHint={session.title}
                                        meta={metaOf(session, Boolean(waitingShared))}
                                        end={
                                          <span data-guide="panelist-invite-actions" className="flex flex-wrap items-center justify-end gap-2">
                                            <Button size="sm" variant="primary" icon={<i className="ti ti-check" aria-hidden="true" />} disabled={invitationSaving} onClick={() => respondToInvitation(session.myInvitation, "ACCEPTED")}>
                                              Accept
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => {
                                              setRespondingInvitation(session.myInvitation);
                                              setDeclineReason("");
                                              setSuggestedAvailability("");
                                            }}>
                                              I’m unavailable
                                            </Button>
                                          </span>
                                        }
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </SectionCard>
                            )}

                            <SectionCard title="Upcoming and live" titleId="ps-upcoming" count={upcoming.length} action={sharedNote(upcomingShared)}>
                              {upcoming.length ? (
                                <ul className="au-list">
                                  {upcoming.map((session: any) => {
                                    const status = statusOf(session);
                                    const live = session.status === "LIVE";
                                    return (
                                      <li key={session.id}>
                                        <ListRow
                                          leading={dateTile(session)}
                                          title={session.title}
                                          titleHint={session.title}
                                          meta={metaOf(session, Boolean(upcomingShared))}
                                          end={
                                            <span className="ps-end">
                                              <span className="ps-status"><StatusDot tone={status.tone}>{status.label}</StatusDot></span>
                                              {meetingLink(session)}
                                              {openWorkspace(session, live)}
                                            </span>
                                          }
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <EmptyNote layout="row" icon="ti-calendar-check" title="Nothing coming up" text="Confirmed and live defenses appear here." />
                              )}
                            </SectionCard>

                            {finished.length > 0 && (
                              <SectionCard title="Completed" titleId="ps-completed" count={finished.length} action={sharedNote(finishedShared)}>
                                <ul className="au-list">
                                  {finished.map((session: any) => {
                                    const submitted = submittedIds.has(session.id);
                                    return (
                                      <li key={session.id}>
                                        <ListRow
                                          leading={dateTile(session, true)}
                                          title={session.title}
                                          titleHint={session.title}
                                          meta={metaOf(session, Boolean(finishedShared))}
                                          end={
                                            <span className="ps-end">
                                              <span className="ps-status">
                                                <StatusDot tone={submitted ? "done" : "neutral"}>{submitted ? "Submitted" : "Completed"}</StatusDot>
                                              </span>
                                              {submitted ? (
                                                <Button size="sm" variant="secondary" onClick={() => router.push(`/panelist/dashboard?tab=evaluation&sessionId=${session.id}`)}>
                                                  View evaluation
                                                </Button>
                                              ) : (
                                                openWorkspace(session)
                                              )}
                                            </span>
                                          }
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              </SectionCard>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              ),
              documents: <PanelistReviewPackets />,
              evaluation: (
                <div data-tour="evaluation-records" data-guide="panelist-evaluation" className="mx-auto flex w-full max-w-[1320px] flex-col gap-4">
                  {evaluationSession?.packet?.evaluationMode ===
                  "STRUCTURED" ? (
                    <StructuredEvaluationWorkspace
                      key={evaluationSession.id}
                      sessionId={evaluationSession.id}
                    />
                  ) : pdfEvaluationSession ? (
                    <PdfEvaluationWorkspace
                      key={pdfEvaluationSession.id}
                      sessionId={pdfEvaluationSession.id}
                    />
                  ) : !liveSession || (requestedSessionId && liveSession.id !== requestedSessionId) ? (
                    (() => {
                      const verificationFailed = Boolean(liveError || dashboardError);
                      const evaluationState = verificationFailed
                        ? "unverified"
                        : !schedules.length
                          ? "no-assignment"
                          : requestedSessionId && !evaluationSession
                            ? "session-unavailable"
                            : "no-live-session";
                      const now = Date.now();
                      const monthOf = (value: Date) => value.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" });
                      const dayOf = (value: Date) => value.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" });
                      const timeOf = (value?: string | null) =>
                        value ? new Date(value).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "";
                      const relativeDay = (value: Date) => {
                        const offset = calendarDaysUntil(value, now);
                        if (offset === 0) return "Today";
                        if (offset === 1) return "Tomorrow";
                        return `${monthOf(value)} ${dayOf(value)}`;
                      };
                      const tile = (value?: string | null, muted = false) => {
                        const date = value ? new Date(value) : null;
                        return (
                          <DateTile
                            tone={muted ? "muted" : undefined}
                            top={date ? monthOf(date) : "TBA"}
                            bottom={date ? dayOf(date) : "—"}
                            label={date ? formatDateTime(value) : "Date to be announced"}
                          />
                        );
                      };
                      const upcoming = [...upcomingSchedules].sort(
                        (a: any, b: any) => new Date(a.scheduledStart || 0).getTime() - new Date(b.scheduledStart || 0).getTime(),
                      );
                      const next: any = upcoming[0];
                      const later = upcoming.slice(1, 4);
                      const nextStart = next?.scheduledStart ? new Date(next.scheduledStart) : null;
                      const nextNeedsResponse = ["PENDING", "RECONFIRMATION_REQUIRED"].includes(next?.myInvitation?.status);
                      const submitted = [
                        ...completedStructuredEvaluations.map((session: any) => ({ key: `structured-${session.id}`, id: session.id, title: session.research?.title, session, at: session.structuredEvaluations?.[0]?.lockedAt || session.endedAt || session.scheduledStart })),
                        ...completedPdfEvaluations.map((session: any) => ({ key: `pdf-${session.id}`, id: session.id, title: session.research?.title, session, at: session.pdfEvaluations?.[0]?.lockedAt || session.endedAt || session.scheduledStart })),
                        ...gradesSubmitted.map((grade: any) => ({
                          key: `grade-${grade.id}`,
                          id: grade.sessionId,
                          title: grade.title,
                          session: [...archives, ...schedules].find((session: any) => session.id === grade.sessionId) as any,
                          at: grade.lockedAt,
                        })),
                      ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
                      const decisionTone = (decision?: string | null): StatusTone =>
                        decision === "APPROVED" ? "done" : decision === "REJECTED" ? "attention" : "waiting";
                      const retry = () => {
                        void queryClient.invalidateQueries({ queryKey: ["active-defense-session"] });
                        void queryClient.invalidateQueries({ queryKey: ["panelist-dashboard-summary"] });
                      };
                      const toSchedule = (
                        <Button size="sm" icon={<i className="ti ti-calendar-event" aria-hidden="true" />} onClick={() => handleTabChange("schedule")}>
                          View defense schedule
                        </Button>
                      );
                      return (
                        <div
                          className="pe"
                          data-guide={verificationFailed ? "panelist-evaluation-unavailable" : "panelist-evaluation-not-live"}
                          data-panelist-evaluation-state={evaluationState}
                        >
                          {verificationFailed ? (
                            <div className="au-card pe-problem" role="alert">
                              <EmptyNote
                                layout="row"
                                tone="problem"
                                icon="ti-alert-triangle"
                                title="We couldn’t check for a live defense"
                                text="Your connection may have dropped. Try again, or contact the session facilitator."
                                action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}
                              />
                            </div>
                          ) : requestedSessionId ? (
                            <div className="au-card">
                              <EmptyNote
                                layout="page"
                                tone="problem"
                                icon="ti-clipboard-off"
                                title="This evaluation is unavailable"
                                text="It may not be live yet, or it’s outside your panel assignments. Check the defense in your schedule."
                                action={toSchedule}
                              />
                            </div>
                          ) : (
                            <>
                              <PageBand
                                titleId="pv-title"
                                eyebrow="Panelist · Philippine time"
                                title="Evaluations"
                                meta="No defense is live right now. Scoring opens when the professor starts one."
                                counts={
                                  <CountStrip
                                    label="Evaluation summary"
                                    items={[
                                      { label: "Live now", value: 0 },
                                      { label: "Upcoming", value: upcoming.length, onClick: () => handleTabChange("schedule") },
                                      { label: "Submitted", value: submitted.length, onClick: () => handleTabChange("grades") },
                                    ]}
                                  />
                                }
                              />
                              {!next && !submitted.length ? (
                                <div className="au-card">
                                  <EmptyNote
                                    layout="page"
                                    icon="ti-clipboard-check"
                                    title="No defenses to score yet"
                                    text="Your score sheets appear here once you’re on a panel and the defense has started."
                                    steps={["You accept a panel invitation", "You review the manuscript", "Score during the live defense"]}
                                    action={toSchedule}
                                  />
                                </div>
                              ) : (
                                <>
                                  {next ? (
                                    <SectionCard
                                      title={<span className="pe-kicker">Next up{nextStart ? ` · ${relativeDay(nextStart)}, ${timeOf(next.scheduledStart)}` : ""}</span>}
                                      titleId="pv-next"
                                      className="pe-focus"
                                    >
                                      <ListRow
                                        leading={tile(next.scheduledStart)}
                                        title={next.title}
                                        titleHint={next.title}
                                        meta={[attendanceMode(next), next.venue && next.venue !== "Online" && next.venue !== "To be announced" ? next.venue : null, next.myInvitation?.role ? readable(next.myInvitation.role) : null].filter(Boolean).join(" · ")}
                                        end={
                                          <Button size="sm" variant="secondary" onClick={() => router.push(`/panelist/defenses/${next.id}`)}>
                                            Open workspace
                                          </Button>
                                        }
                                      />
                                      <p className="pe-card-note">
                                        <i className="ti ti-info-circle" aria-hidden="true" />
                                        {nextNeedsResponse
                                          ? "Accept your invitation in the workspace first. The score sheet unlocks here when the defense starts."
                                          : "The score sheet unlocks here automatically when the defense starts. You can read the manuscript beforehand."}
                                      </p>
                                    </SectionCard>
                                  ) : (
                                    <div className="au-card">
                                      <EmptyNote layout="row" icon="ti-calendar-event" title="No upcoming defenses" text="New panel assignments appear here." action={toSchedule} />
                                    </div>
                                  )}
                                  {(later.length > 0 || submitted.length > 0) && (
                                  <div className={later.length > 0 && submitted.length > 0 ? "pe-pair" : "pe"}>
                                    {later.length > 0 && (
                                    <SectionCard
                                      title="Later defenses"
                                      titleId="pv-later"
                                      count={later.length}
                                      action={<CardLink onClick={() => handleTabChange("schedule")}>Schedule</CardLink>}
                                    >
                                        <ul className="au-list">
                                          {later.map((session: any) => (
                                            <li key={session.id}>
                                              <ListRow
                                                leading={tile(session.scheduledStart)}
                                                title={session.title}
                                                titleHint={session.title}
                                                meta={[timeOf(session.scheduledStart), attendanceMode(session)].filter(Boolean).join(" · ")}
                                                onClick={() => router.push(`/panelist/defenses/${session.id}`)}
                                              />
                                            </li>
                                          ))}
                                        </ul>
                                    </SectionCard>
                                    )}
                                    {submitted.length > 0 && (
                                    <SectionCard
                                      title="Recently submitted"
                                      titleId="pv-submitted"
                                      count={submitted.length}
                                      action={<CardLink onClick={() => handleTabChange("grades")}>Results</CardLink>}
                                    >
                                        <ul className="au-list">
                                          {submitted.slice(0, 3).map((row) => (
                                            <li key={row.key}>
                                              <ListRow
                                                leading={tile(row.at, true)}
                                                title={row.title || "Research project"}
                                                titleHint={row.title}
                                                meta={[row.session?.defenseEvent?.defenseType ? readable(row.session.defenseEvent.defenseType) : "Defense", "locked"].join(" · ")}
                                                end={
                                                  row.session?.releasedAt ? (
                                                    <StatusDot tone={decisionTone(row.session?.decision)}>{readable(row.session?.decision, "Released")}</StatusDot>
                                                  ) : (
                                                    <StatusDot tone="neutral">Awaiting release</StatusDot>
                                                  )
                                                }
                                                onClick={() => router.push(`/panelist/dashboard?tab=evaluation&sessionId=${row.id}`)}
                                              />
                                            </li>
                                          ))}
                                        </ul>
                                    </SectionCard>
                                    )}
                                  </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />{" "}
                              Live defense · session verified
                            </div>
                            <h2 className="mt-2 text-xl font-extrabold text-[#102f49] dark:text-white">
                              {liveSession.research.title}
                            </h2>
                            <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
                              {liveSession.research.researchType?.name ||
                                "Research defense"}
                              {liveSession.venue
                                ? ` · ${liveSession.venue}`
                                : ""}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200">
                            <i className="ti ti-lock-check mr-2 text-emerald-600" />
                            Scores are bound to this session
                          </div>
                        </div>
                      </section>
                      {!activeTemplate ? (
                        <div data-guide="panelist-evaluation-unavailable" data-panelist-evaluation-state="missing-rubric" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          No published evaluation rubric is available for this
                          research type.
                        </div>
                      ) : liveSession.evaluations?.[0]?.status === "LOCKED" ? (
                        <section className="rounded-2xl border border-emerald-200 bg-[var(--color-surface)] p-8 text-center">
                          <i className="ti ti-lock-check text-5xl text-emerald-600" />
                          <h3 data-guide="panelist-evaluation-locked" data-panelist-evaluation-state="locked" className="mt-3 text-xl font-extrabold text-[var(--color-text-primary)]">
                            Final evaluation locked
                          </h3>
                          <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                            Submitted{" "}
                            {formatDateTime(
                              liveSession.evaluations[0].lockedAt,
                            )}
                            . This record cannot be overwritten.
                          </p>
                          <div className="mx-auto mt-5 max-w-md rounded-xl bg-[var(--color-surface-subtle)] p-4 text-left text-sm">
                            <div className="flex justify-between">
                              <span>Total score</span>
                              <strong>
                                {Number(liveSession.evaluations[0].totalScore)}{" "}
                                / {Number(activeTemplate.totalScore)}
                              </strong>
                            </div>
                            <div className="mt-2 flex justify-between">
                              <span>Recommendation</span>
                              <strong>
                                {readable(
                                  liveSession.evaluations[0].recommendation,
                                )}
                              </strong>
                            </div>
                            <div className="mt-3 break-all text-xs text-[var(--color-text-muted)]">
                              Integrity hash:{" "}
                              {liveSession.evaluations[0].integrityHash}
                            </div>
                          </div>
                        </section>
                      ) : (
                        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-extrabold text-[#1b4264]">
                                {activeTemplate.name}
                              </h3>
                              <p className="mt-1 text-base text-slate-500">
                                Rubric version {activeTemplate.version}.
                                Incomplete drafts can be saved; final submission
                                requires every score and is permanently locked.
                              </p>
                            </div>
                            <Tag variant="warn">
                              Draft · v{activeTemplate.version}
                            </Tag>
                          </div>
                          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                            {activeTemplate.criteria.map(
                              (criterion: any, index: number) => (
                                <div
                                  key={criterion.id}
                                  className={`grid gap-3 p-4 md:grid-cols-[1fr_140px] ${index ? "border-t border-[var(--color-border)]" : ""}`}
                                >
                                  <div>
                                    <label
                                      htmlFor={`score-${criterion.id}`}
                                      className="font-extrabold text-[var(--color-text-primary)]"
                                    >
                                      {index + 1}. {criterion.criterion}
                                    </label>
                                    {criterion.description && (
                                      <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                                        {criterion.description}
                                      </p>
                                    )}
                                    <textarea
                                      value={
                                        criterionComments[criterion.id] || ""
                                      }
                                      onChange={(event) => {
                                        setCriterionComments((current) => ({
                                          ...current,
                                          [criterion.id]: event.target.value,
                                        }));
                                        setEvaluationDirty(true);
                                      }}
                                      placeholder="Optional criterion comment"
                                      className="mt-3 min-h-16 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-base text-[var(--color-text-primary)] outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      htmlFor={`score-${criterion.id}`}
                                      className="text-sm font-bold text-[var(--color-text-secondary)]"
                                    >
                                      Score (max {Number(criterion.maxScore)})
                                    </label>
                                    <input
                                      id={`score-${criterion.id}`}
                                      type="number"
                                      min="0"
                                      max={Number(criterion.maxScore)}
                                      step="0.01"
                                      value={
                                        criterionScores[criterion.id] ?? ""
                                      }
                                      onChange={(event) => {
                                        setCriterionScores((current) => ({
                                          ...current,
                                          [criterion.id]:
                                            event.target.value === ""
                                              ? ""
                                              : Number(event.target.value),
                                        }));
                                        setEvaluationDirty(true);
                                      }}
                                      className="mt-2 h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-lg font-extrabold text-[var(--color-text-primary)] outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100"
                                    />
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="text-sm font-bold text-[var(--color-text-primary)]">
                              Panel recommendation
                              <select
                                value={activeRecommendation}
                                onChange={(event) => {
                                  setActiveRecommendation(event.target.value);
                                  setEvaluationDirty(true);
                                }}
                                className="mt-2 h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 outline-none focus:border-[#f6a800]"
                              >
                                <option value="APPROVE">Approve</option>
                                <option value="MINOR_REVISION">
                                  Minor revisions
                                </option>
                                <option value="MAJOR_REVISION">
                                  Major revisions
                                </option>
                                <option value="REJECT">Reject</option>
                              </select>
                            </label>
                            <label className="text-sm font-bold text-[var(--color-text-primary)]">
                              Overall remarks
                              <textarea
                                value={activeRemarks}
                                onChange={(event) => {
                                  setActiveRemarks(event.target.value);
                                  setEvaluationDirty(true);
                                }}
                                placeholder="Summarize strengths and required revisions"
                                className="mt-2 min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-normal outline-none focus:border-[#f6a800]"
                              />
                            </label>
                          </div>
                          {evaluationError && (
                            <div
                              role="alert"
                              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700"
                            >
                              {evaluationError}
                            </div>
                          )}
                          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                            <button
                              data-guide="panelist-save-draft"
                              onClick={() => handleSaveEvaluation(false)}
                              disabled={isSavingEvaluation}
                              className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-extrabold text-[#173f63] disabled:opacity-50"
                            >
                              Save draft
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Submit this final evaluation? It will be locked and cannot be changed.",
                                  )
                                )
                                  handleSaveEvaluation(true);
                              }}
                              disabled={isSavingEvaluation}
                              data-guide="panelist-final-evaluation"
                              className="submission-action h-11 rounded-xl bg-[#f6a800] px-5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"
                            >
                              <i className="ti ti-lock-check mr-2" />
                              Submit final & lock
                            </button>
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              ),
              grades: (
                <div data-guide="panelist-results" className="pe">
                  {(() => {
                    const lookup = (id: string) =>
                      [...completedStructuredEvaluations, ...completedPdfEvaluations, ...archives, ...schedules].find(
                        (session: any) => session.id === id,
                      ) as any;
                    const defenseLabel = (session: any) =>
                      session?.defenseEvent?.defenseType ? readable(session.defenseEvent.defenseType) : "Defense";
                    const rows = [
                      ...completedStructuredEvaluations.map((session: any) => ({
                        key: `structured-${session.id}`,
                        sessionId: session.id,
                        session,
                        title: session.research?.title,
                        kind: "Structured evaluation",
                        at: session.structuredEvaluations?.[0]?.lockedAt || session.endedAt || session.scheduledStart,
                      })),
                      ...completedPdfEvaluations.map((session: any) => ({
                        key: `pdf-${session.id}`,
                        sessionId: session.id,
                        session,
                        title: session.research?.title,
                        kind: "PDF evaluation",
                        at: session.pdfEvaluations?.[0]?.lockedAt || session.endedAt || session.scheduledStart,
                      })),
                      ...gradesSubmitted.map((grade: any) => ({
                        key: `grade-${grade.id}`,
                        sessionId: grade.sessionId,
                        session: lookup(grade.sessionId),
                        title: grade.title,
                        kind: `Score ${grade.score}${grade.maximum ? ` / ${grade.maximum}` : ""}`,
                        at: grade.lockedAt,
                      })),
                    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
                    const awaiting = rows.filter((row) => !row.session?.releasedAt);
                    const released = rows.filter((row) => row.session?.releasedAt);
                    const decisionTone = (decision?: string | null): StatusTone =>
                      decision === "APPROVED" ? "done" : decision === "REJECTED" ? "attention" : "waiting";
                    const renderRows = (list: typeof rows) => (
                      <ul className="au-list">
                        {list.map((row) => {
                          const at = row.at ? new Date(row.at) : null;
                          const isReleased = Boolean(row.session?.releasedAt);
                          return (
                            <li key={row.key}>
                              <ListRow
                                leading={
                                  <DateTile
                                    top={at ? at.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }) : "—"}
                                    bottom={at ? at.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }) : "—"}
                                    label={at ? formatDateTime(row.at) : "Date not recorded"}
                                  />
                                }
                                title={row.title || "Research project"}
                                titleHint={row.title}
                                meta={
                                  <span data-guide="panelist-release-status">
                                    {defenseLabel(row.session)} · {row.kind} · locked
                                    {isReleased && row.session?.releasedAt ? ` · released ${formatDate(row.session.releasedAt)}` : ""}
                                  </span>
                                }
                                end={
                                  <span className="ps-end">
                                    <span className="ps-status">
                                      {isReleased ? (
                                        <StatusDot tone={decisionTone(row.session?.decision)}>{readable(row.session?.decision, "Released")}</StatusDot>
                                      ) : (
                                        <StatusDot tone="neutral">Awaiting release</StatusDot>
                                      )}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      data-guide="panelist-completed-evaluation"
                                      onClick={() => router.push(`/panelist/dashboard?tab=evaluation&sessionId=${row.sessionId}`)}
                                    >
                                      View evaluation
                                    </Button>
                                  </span>
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    );
                    return (
                      <>
                        <PageBand
                          titleId="pr-title"
                          eyebrow="Panelist · Results"
                          title="Your submitted evaluations"
                          meta="Your locked scores and the panel’s released decisions."
                          counts={
                            <CountStrip
                              label="Results summary"
                              items={[
                                { label: "Submitted", value: rows.length },
                                { label: "Released", value: released.length },
                                { label: "Awaiting release", value: awaiting.length, tone: awaiting.length ? "waiting" : undefined },
                              ]}
                            />
                          }
                        />
                        {!rows.length ? (
                          <SectionCard title="Your evaluations" titleId="pr-empty">
                            <EmptyNote layout="page" icon="ti-award" title="No submitted evaluations yet" text="Evaluations you submit and lock appear here, with the panel’s decision once it’s released." action={<Button size="sm" icon={<i className="ti ti-calendar-event" aria-hidden="true" />} onClick={() => handleTabChange("schedule")}>View defense schedule</Button>} />
                          </SectionCard>
                        ) : (
                          <>
                            {awaiting.length > 0 && (
                              <SectionCard title="Awaiting release" titleId="pr-awaiting" count={awaiting.length} action={<span className="au-row-meta">The professor or facilitator releases decisions</span>}>
                                {renderRows(awaiting)}
                              </SectionCard>
                            )}
                            {released.length > 0 && (
                              <SectionCard title="Released decisions" titleId="pr-released" count={released.length}>
                                {renderRows(released)}
                              </SectionCard>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              ),
              history: (
                <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-6">
                  <h3 className="font-extrabold text-[#1b4264] text-lg">
                    Defense Archives
                  </h3>
                  <p className="text-base text-slate-400 font-bold">
                    Completed panel assignments with your evaluation and
                    recommendation records.
                  </p>
                  <div className="mt-2 flex flex-col gap-3">
                    {archives.map((session: any) => {
                      const evaluation = session.evaluations?.[0];
                      const recommendation = session.recommendations?.[0];
                      return (
                        <div
                          key={session.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] shadow-sm dark:border-white/10 dark:bg-white/5"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <strong className="block text-[#1b4264] dark:text-white">
                                {session.research.title}
                              </strong>
                              <span data-guide="panelist-release-status" className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                Completed {formatDateTime(session.endedAt)} ·
                                Official decision:{" "}
                                {session.releasedAt
                                  ? readable(session.decision)
                                  : "Pending authorized release"}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                {session.packet?.evaluationMode === "STRUCTURED"
                                  ? `Digital evaluation: ${session.structuredEvaluations?.[0]?.lockedAt ? "Submitted and locked" : "Not submitted"}`
                                  : session.packet?.evaluationMode === "PDF"
                                    ? `PDF evaluation: ${readable(session.pdfEvaluations?.[0]?.status, "Not submitted")}`
                                    : `Your score: ${evaluation?.totalScore ?? "Not recorded"}`}{" "}
                                · Recommendation:{" "}
                                {readable(
                                  session.packet?.evaluationMode ===
                                    "STRUCTURED"
                                    ? session.structuredEvaluations?.[0]
                                        ?.lockedAt
                                      ? "INCLUDED_IN_EVALUATION"
                                      : null
                                    : recommendation?.status,
                                  "Not submitted",
                                )}
                              </span>
                            </div>
                            <Tag
                              variant={
                                session.decision === "REJECTED"
                                  ? "danger"
                                  : session.releasedAt
                                    ? "success"
                                    : "warn"
                              }
                            >
                              {session.releasedAt ? "Released" : "Completed"}
                            </Tag>
                          </div>
                          {(session.structuredEvaluations?.[0]?.lockedAt || session.pdfEvaluations?.[0]?.status === "LOCKED") && <button type="button" onClick={() => router.push(`/panelist/dashboard?tab=evaluation&sessionId=${session.id}`)} className="mt-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-bold">View my completed evaluation</button>}
                        </div>
                      );
                    })}
                    {archives.length === 0 && (
                      <EmptyNote layout="page" icon="ti-archive" title="No completed defenses yet" text="Finished panel assignments appear here with your evaluation and the decision." />
                    )}
                  </div>
                </div>
              ),
            };

            return tabContent[activeTab] || tabContent.overview;
          })()}
        </div>
      </div>
    </>
  );
}

export default function PanelistDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PanelistDashboardContent />
    </Suspense>
  );
}
