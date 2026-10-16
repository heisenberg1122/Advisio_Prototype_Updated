import React, { useState, Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { DashboardWelcome } from "@/components/ui/DashboardWelcome";
import { CardsPageSkeleton, DashboardSkeleton, ListPageSkeleton, TablePageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { PanelistReviewPackets } from "@/components/panelist/PanelistReviewPackets";
import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";

function PanelistDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ["panelist-dashboard-summary"],
    queryFn: () => apiClient.get("/api/panelist/dashboard-summary"),
    refetchInterval: 15000,
  });

  const { data: liveData, isLoading: liveLoading, error: liveError } = useQuery({
    queryKey: ["active-defense-session"],
    queryFn: () => apiClient.get<{ session: any | null }>("/api/defense-sessions/active"),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
  const liveSession = liveData?.session || null;
  const { data: templateData } = useQuery({
    queryKey: ["evaluation-templates", liveSession?.research?.researchTypeId],
    queryFn: () => apiClient.get<{ templates: any[] }>("/api/evaluation-templates", { params: { researchTypeId: liveSession.research.researchTypeId } }),
    enabled: Boolean(liveSession?.research?.researchTypeId),
  });
  const activeTemplate =
    liveSession?.evaluations?.[0]?.template || templateData?.templates?.[0] || null;

  const assignedProjects = dashboardData?.assignedProjects || [];
  const documents = dashboardData?.pendingReviews || [];
  const evaluations = dashboardData?.pendingEvaluations || [];
  const archives = dashboardData?.archives || [];
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
        date: session.scheduledStart ? new Date(session.scheduledStart).toLocaleDateString() : "Pending",
        time: session.scheduledStart ? new Date(session.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Awaiting schedule",
        venue: session.venue || (session.meetingUrl ? "Online" : "To be announced"),
        type: session.status.replace(/_/g, " "),
        myInvitation: session.invitations?.[0] || null,
      })),
    [dashboardData?.sessions],
  );
  const upcomingSchedules = useMemo(
    () => schedules.filter((session: any) => dashboardData?.upcomingSessions?.some((item: any) => item.id === session.id)),
    [schedules, dashboardData?.upcomingSessions],
  );

  const [criterionScores, setCriterionScores] = useState<Record<string, number | "">>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [activeRecommendation, setActiveRecommendation] = useState("APPROVE");
  const [activeRemarks, setActiveRemarks] = useState("");
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [respondingInvitation, setRespondingInvitation] = useState<any | null>(null);
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [suggestedAvailability, setSuggestedAvailability] = useState("");
  const [invitationSaving, setInvitationSaving] = useState(false);

  useEffect(() => {
    const existing = liveSession?.evaluations?.[0];
    const stored = Array.isArray(existing?.criteriaScores) ? existing.criteriaScores : [];
    if (activeTemplate?.criteria) {
      setCriterionScores(Object.fromEntries(activeTemplate.criteria.map((criterion: any) => [criterion.id, stored.find((item: any) => item.criterionId === criterion.id)?.score ?? ""])));
      setCriterionComments(Object.fromEntries(activeTemplate.criteria.map((criterion: any) => [criterion.id, stored.find((item: any) => item.criterionId === criterion.id)?.comment ?? ""])));
    }
    setActiveRecommendation(existing?.recommendation || "APPROVE");
    setActiveRemarks(existing?.remarks || "");
  }, [liveSession?.id, liveSession?.evaluations?.[0]?.id, activeTemplate?.id]);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const respondToInvitation = async (invitation: any, response: "ACCEPTED" | "DECLINED") => {
    if (response === "DECLINED" && !declineReason.trim()) {
      triggerToast("Please provide a reason before declining.");
      return;
    }
    setInvitationSaving(true);
    try {
      await apiClient.patch(`/api/defense-management/invitations/${invitation.id}/respond`, {
        response,
        responseNote: declineReason,
        suggestedAvailability: suggestedAvailability ? [new Date(suggestedAvailability).toISOString()] : [],
      });
      await queryClient.invalidateQueries({ queryKey: ["panelist-dashboard-summary"] });
      setRespondingInvitation(null);
      setDeclineReason("");
      setSuggestedAvailability("");
      triggerToast(response === "ACCEPTED" ? "Defense invitation accepted." : "Your unavailability was sent to the professor.");
    } catch (error: any) {
      triggerToast(error?.message || "Your response could not be saved.");
    } finally {
      setInvitationSaving(false);
    }
  };

  const handleSaveEvaluation = async (final: boolean) => {
    if (!liveSession || !activeTemplate) return;
    setEvaluationError(null);
    setIsSavingEvaluation(true);
    try {
      const result = await apiClient.put<any>(`/api/defense-sessions/${liveSession.id}/evaluation`, {
        templateId: activeTemplate.id,
        recommendation: activeRecommendation,
        remarks: activeRemarks,
        final,
        criteriaScores: activeTemplate.criteria.map((criterion: any) => ({ criterionId: criterion.id, score: criterionScores[criterion.id], comment: criterionComments[criterion.id] || "" })),
      });
      await queryClient.invalidateQueries({ queryKey: ["active-defense-session"] });
      await queryClient.invalidateQueries({ queryKey: ["panelist-dashboard-summary"] });
      triggerToast(final ? "Final evaluation submitted and locked." : "Evaluation draft saved securely.");
      if (final && result.generatedVersion?.googleDriveFileId) {
        setSigningDocument({ versionId: result.generatedVersion.id, docName: "Panelist Evaluation", groupName: liveSession.research.title, fileUrl: `/api/documents/files/${result.generatedVersion.googleDriveFileId}` });
      }
    } catch (error: any) {
      setEvaluationError(error?.message || "The evaluation could not be saved.");
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  const router = useRouter();
  const handleTabChange = (tab: string) => {
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
      {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(message) => { setSigningDocument(null); triggerToast(message); queryClient.invalidateQueries({ queryKey: ["active-defense-session"] }); }} />}

    <div className="flex min-h-full flex-1 flex-col bg-transparent font-sans text-slate-800">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border border-white/10 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      {respondingInvitation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="decline-defense-title"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wider text-rose-600">Availability response</p><h2 id="decline-defense-title" className="mt-1 text-xl font-extrabold text-[#102f49]">Cannot attend this schedule?</h2><p className="mt-1 text-sm text-slate-500">Your reason is shared with the professor, not the research group.</p></div><button type="button" onClick={() => setRespondingInvitation(null)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><i className="ti ti-x" /></button></div><label className="mt-5 block text-sm font-bold text-slate-700">Reason<textarea required value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={4} placeholder="Explain why you are unavailable…" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label><label className="mt-4 block text-sm font-bold text-slate-700">Suggested alternative <span className="font-normal text-slate-400">(optional)</span><input type="datetime-local" value={suggestedAvailability} onChange={(event) => setSuggestedAvailability(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRespondingInvitation(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Keep invitation</button><button type="button" onClick={() => respondToInvitation(respondingInvitation, "DECLINED")} disabled={invitationSaving || !declineReason.trim()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Decline and notify professor</button></div></div></div>}

      {/* MAIN CONTAINER */}
      <div className={`flex w-full flex-1 flex-col space-y-6 ${activeTab === "messages" ? "max-w-none p-3 sm:p-4 lg:p-5" : "mx-auto max-w-[1360px] p-4 sm:p-6 lg:p-8"}`}>
        
        {(() => {
          const tabContent: Record<string, React.ReactNode> = {
            messages: <FacultyGroupChats triggerToast={triggerToast} />,
            overview: (
              <div className="flex w-full flex-col gap-6">
                <DashboardWelcome
                  firstName={user?.firstName}
                  fallbackName="Panelist"
                  summary="Here's an overview of your assigned research projects, defense schedules, and evaluations."
                  actions={
                    <>
                      <button
                        onClick={() => handleTabChange("evaluation")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-5 text-sm font-bold text-white shadow-xs transition"
                      >
                        <i className="ti ti-clipboard-check text-base" /> Start Evaluation
                      </button>
                      <button
                        onClick={() => handleTabChange("schedule")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white/80 dark:bg-white/10 px-4 text-sm font-semibold text-[var(--color-text-primary)] dark:text-white dark:border-white/20 shadow-2xs backdrop-blur-xs transition hover:bg-white dark:hover:bg-white/20"
                      >
                        <i className="ti ti-calendar-event text-base" /> Defense Schedule ({upcomingSchedules.length})
                      </button>
                      <button
                        onClick={() => handleTabChange("documents")}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-white/80 dark:bg-white/10 px-4 text-sm font-semibold text-[var(--color-text-primary)] dark:text-white dark:border-white/20 shadow-2xs backdrop-blur-xs transition hover:bg-white dark:hover:bg-white/20"
                      >
                        <i className="ti ti-file-text text-base" /> Review Manuscripts ({documents.length})
                      </button>
                    </>
                  }
                />
                {/* Key Metrics Grid - Standardized UA Institutional Pattern */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Assigned Projects",
                      value: dashboardData?.counts?.assignedProjects || 0,
                      suffix: "projects",
                      icon: "ti-flask",
                      tone: "bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#38bdf8]",
                      tab: "documents",
                    },
                    {
                      label: "Pending Evaluations",
                      value: evaluations.length,
                      suffix: "to score",
                      icon: "ti-clipboard-check",
                      tone: "bg-[#C9A227]/15 text-[#8A6A0B] dark:text-[#C9A227]",
                      tab: "evaluation",
                    },
                    {
                      label: "Completed Evaluations",
                      value: gradesSubmitted.length,
                      suffix: "submitted",
                      icon: "ti-circle-check",
                      tone: "bg-blue-50 text-[#0B3A53] dark:bg-white/10 dark:text-white",
                      tab: "grades",
                    },
                    {
                      label: "Upcoming Defenses",
                      value: upcomingSchedules.length,
                      suffix: "scheduled",
                      icon: "ti-calendar-event",
                      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                      tab: "schedule",
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleTabChange(item.tab)}
                      className="group flex min-h-[96px] items-center gap-4 rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-4 sm:p-5 text-left shadow-xs transition hover:shadow-md hover:border-[#0B3A53]/40 hover:-translate-y-0.5 outline-none"
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${item.tone}`}>
                        <i className={`ti ${item.icon}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-2xl font-black text-[#0B3A53] dark:text-white truncate">
                          {item.value} <small className="text-xs font-semibold text-slate-400">· {item.suffix}</small>
                        </span>
                      </span>
                    </button>
                  ))}
                </section>

                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#17212B] dark:text-white sm:text-lg">Assigned Research Projects</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Research work currently available within your panel assignment scope.</p>
                    </div>
                    <button onClick={() => handleTabChange("documents")} className="shrink-0 text-xs font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]">
                      Review manuscripts <i className="ti ti-chevron-right" />
                    </button>
                  </div>
                  {assignedProjects.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {assignedProjects.slice(0, 3).map((project: any) => (
                        <button key={project.id} onClick={() => handleTabChange("documents")} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-left transition hover:border-[#0B3A53]/30 hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5">
                          <span className="flex items-start justify-between gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]"><i className="ti ti-flask" /></span>
                            <Tag variant={project.status === "COMPLETED" ? "success" : "info"}>{String(project.status || "ACTIVE").replace(/_/g, " ")}</Tag>
                          </span>
                          <span className="mt-3 block truncate text-sm font-bold text-[#17212B] dark:text-white">{project.title || "Untitled research project"}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{project.workflowInstance?.currentStage?.name || "Research review"}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center dark:border-white/10">
                      <i className="ti ti-flask-off text-2xl text-slate-300" />
                      <p className="mt-2 text-sm font-bold text-[#17212B] dark:text-white">No assigned research projects</p>
                      <p className="text-xs text-slate-400">Projects will appear here when a defense panel is assigned.</p>
                    </div>
                  )}
                </section>

                {/* Upcoming Defenses & Evaluation Queue */}
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.95fr]">
                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#17212B] dark:text-white">
                          Upcoming Defenses
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Your assigned oral defense panel schedule.
                        </p>
                      </div>
                      <button
                        onClick={() => handleTabChange("schedule")}
                        className="flex items-center gap-1 text-xs font-bold text-[#0B3A53] hover:underline dark:text-[#C9A227]"
                      >
                        View schedule <i className="ti ti-chevron-right text-xs" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {upcomingSchedules.length ? (
                        upcomingSchedules.slice(0, 3).map((s: any) => (
                          <button
                            key={s.id}
                            onClick={() => handleTabChange("schedule")}
                            className="flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5"
                          >
                            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-white">
                              <i className="ti ti-calendar text-xl" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-sm text-[#17212B] dark:text-white">
                                {s.title}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                {s.date} · {s.time} · {s.venue}
                              </span>
                            </span>
                            <i className="ti ti-chevron-right text-slate-400" />
                          </button>
                        ))
                      ) : (
                        <div className="flex min-h-40 flex-col items-center justify-center text-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
                            <i className="ti ti-calendar-time text-2xl" />
                          </span>
                          <p className="mt-3 font-bold text-sm text-[#17212B] dark:text-white">
                            No defenses scheduled
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            New panel assignments will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                    <h3 className="text-base sm:text-lg font-bold text-[#17212B] dark:text-white">
                      Evaluation Queue
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Research groups waiting for your evaluation score.
                    </p>
                    <div className="space-y-3">
                      {evaluations.length ? (
                        evaluations.slice(0, 3).map((e: any) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-white/5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-bold text-sm text-[#17212B] dark:text-white">
                                {e.research.title}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Ready for evaluation
                              </span>
                            </span>
                            <button
                              onClick={() => handleTabChange("evaluation")}
                              className="ml-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2 text-xs font-bold text-white shadow-xs transition"
                            >
                              Evaluate
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center dark:border-white/10 dark:bg-white/5">
                          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <i className="ti ti-circle-check text-lg" />
                          </span>
                          <p className="font-bold text-sm text-[#17212B] dark:text-white">
                            You’re all caught up
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            New evaluation sheets will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                </section>

                {/* Recent Activity & Quick Actions */}
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_.85fr]">
                  <article className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
                    <h3 className="text-base font-bold text-[#17212B] dark:text-white">Recent Evaluation Activity</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your latest completed evaluations and available manuscripts.</p>
                    <div className="mt-4 space-y-2.5">
                      {gradesSubmitted.slice(0, 3).map((grade) => (
                        <button key={grade.id} onClick={() => handleTabChange("grades")} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><i className="ti ti-circle-check" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#17212B] dark:text-white">{grade.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">Evaluation submitted · {grade.score} points</span></span>
                        </button>
                      ))}
                      {gradesSubmitted.length === 0 && documents.slice(0, 3).map((document: any) => (
                        <button key={document.id} onClick={() => handleTabChange("documents")} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:bg-white hover:shadow-xs dark:border-white/5 dark:bg-white/5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]"><i className="ti ti-file-text" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#17212B] dark:text-white">{document.research.title}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">Defense packet · awaiting completed review</span></span>
                        </button>
                      ))}
                      {gradesSubmitted.length === 0 && documents.length === 0 && (
                        <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center dark:border-white/10">
                          <i className="ti ti-history text-2xl text-slate-300" />
                          <p className="mt-2 text-sm font-bold text-[#17212B] dark:text-white">No recent evaluation activity</p>
                          <p className="text-xs text-slate-400">Completed evaluations and manuscript reviews will appear here.</p>
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 shadow-xs">
                  <h3 className="mb-4 text-base font-bold text-[#17212B] dark:text-white">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "View schedule", icon: "ti-calendar-event", tab: "schedule" },
                      { label: "Review documents", icon: "ti-file-search", tab: "documents" },
                      { label: "Score defense", icon: "ti-clipboard-check", tab: "evaluation" },
                      { label: "View results", icon: "ti-award", tab: "grades" },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleTabChange(action.tab)}
                        className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-3 text-left transition hover:border-[#0B3A53] dark:hover:border-[#C9A227] hover:bg-white hover:shadow-xs"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3A53]/10 dark:bg-white/10 text-lg text-[#0B3A53] dark:text-[#C9A227]">
                          <i className={`ti ${action.icon}`} />
                        </span>
                        <span className="text-xs font-bold text-[#17212B] dark:text-white">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  </article>
                </section>
              </div>
            ),
            schedule: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review invitations, confirmed defenses, rescheduling requests, and completed assignments.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Awaiting response", dashboardData?.counts?.pendingInvitations || 0, "text-amber-700 bg-amber-50"],
                    ["Confirmed upcoming", dashboardData?.counts?.upcomingDefenses || 0, "text-emerald-700 bg-emerald-50"],
                    ["Rescheduling", dashboardData?.counts?.rescheduling || 0, "text-rose-700 bg-rose-50"],
                    ["Completed", dashboardData?.counts?.archivedDefenses || 0, "text-sky-700 bg-sky-50"],
                  ].map(([label, value, tone]) => <div key={String(label)} className={`rounded-xl p-3 ${tone}`}><span className="block text-[10px] font-extrabold uppercase tracking-wider">{label}</span><strong className="mt-1 block text-xl">{value}</strong></div>)}
                </div>
                <div className="flex flex-col gap-3 mt-2">
                  {schedules.length > 0 ? (
                    schedules.map(s => (
                      <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="block font-bold text-[#1b4264]">{s.title}</span><span className="text-[11px] text-slate-500">{s.date} at {s.time} · Venue: {s.venue}</span><span className="mt-1 block text-[11px] font-bold text-slate-600">Invited as {s.myInvitation?.role?.replace(/_/g, " ")} · Response: {s.myInvitation?.status?.replace(/_/g, " ")}</span></div><Tag variant={s.status === "SCHEDULED" ? "success" : s.status === "NEEDS_RESCHEDULING" ? "danger" : s.status === "COMPLETED" ? "info" : "warn"}>{s.type}</Tag></div>
                        {s.myInvitation && ["PENDING", "RECONFIRMATION_REQUIRED"].includes(s.myInvitation.status) && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => respondToInvitation(s.myInvitation, "ACCEPTED")} disabled={invitationSaving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"><i className="ti ti-check mr-1" />Accept invitation</button><button type="button" onClick={() => { setRespondingInvitation(s.myInvitation); setDeclineReason(""); setSuggestedAvailability(""); }} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-extrabold text-rose-700"><i className="ti ti-x mr-1" />I’m unavailable</button></div>}
                        {s.myInvitation?.status === "ACCEPTED" && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-800"><i className="ti ti-circle-check mr-1" />You accepted this defense invitation.</p>}
                        {s.myInvitation?.status === "DECLINED" && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-800"><i className="ti ti-calendar-exclamation mr-1" />You declined this schedule. The professor has been notified.</p>}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No defense schedules assigned yet.
                    </div>
                  )}
                </div>
              </div>
            ),
            documents: (
              <PanelistReviewPackets />
            ),
            evaluation: (
              <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
                {!liveSession ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><i className="ti ti-broadcast-off text-4xl text-slate-300" /><h3 className="mt-3 text-lg font-extrabold text-[#1b4264]">No live defense session</h3><p className="mt-1 text-sm text-slate-500">The scoring sheet will unlock automatically when the professor starts your assigned defense.</p>{liveError && <p className="mt-3 text-xs font-bold text-rose-600">Unable to verify the active session. Refresh or contact the session facilitator.</p>}</div> : (
                  <>
                    <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /> Live defense · session verified</div><h2 className="mt-2 text-xl font-extrabold text-[#102f49]">{liveSession.research.title}</h2><p className="mt-1 text-sm text-slate-600">{liveSession.research.researchType?.name || "Research defense"}{liveSession.venue ? ` · ${liveSession.venue}` : ""}</p></div><div className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm"><i className="ti ti-lock-check mr-2 text-emerald-600" />Scores are bound to this session</div></div>
                    </section>
                    {!activeTemplate ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">No published evaluation rubric is available for this research type.</div> : liveSession.evaluations?.[0]?.status === "LOCKED" ? (
                      <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center"><i className="ti ti-lock-check text-5xl text-emerald-600" /><h3 className="mt-3 text-xl font-extrabold text-[#102f49]">Final evaluation locked</h3><p className="mt-2 text-sm text-slate-500">Submitted {new Date(liveSession.evaluations[0].lockedAt).toLocaleString()}. This record cannot be overwritten.</p><div className="mx-auto mt-5 max-w-md rounded-xl bg-slate-50 p-4 text-left text-sm"><div className="flex justify-between"><span>Total score</span><strong>{Number(liveSession.evaluations[0].totalScore)} / {Number(activeTemplate.totalScore)}</strong></div><div className="mt-2 flex justify-between"><span>Recommendation</span><strong>{String(liveSession.evaluations[0].recommendation).replace(/_/g, " ")}</strong></div><div className="mt-3 break-all text-[10px] text-slate-400">Integrity hash: {liveSession.evaluations[0].integrityHash}</div></div></section>
                    ) : (
                      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-extrabold text-[#1b4264]">{activeTemplate.name}</h3><p className="mt-1 text-sm text-slate-500">Rubric version {activeTemplate.version}. Incomplete drafts can be saved; final submission requires every score and is permanently locked.</p></div><Tag variant="warn">Draft · v{activeTemplate.version}</Tag></div>
                        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                          {activeTemplate.criteria.map((criterion: any, index: number) => <div key={criterion.id} className={`grid gap-3 p-4 md:grid-cols-[1fr_140px] ${index ? "border-t border-slate-200" : ""}`}><div><label htmlFor={`score-${criterion.id}`} className="font-extrabold text-[#102f49]">{index + 1}. {criterion.criterion}</label>{criterion.description && <p className="mt-1 text-xs text-slate-500">{criterion.description}</p>}<textarea value={criterionComments[criterion.id] || ""} onChange={(event) => setCriterionComments((current) => ({ ...current, [criterion.id]: event.target.value }))} placeholder="Optional criterion comment" className="mt-3 min-h-16 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100" /></div><div><label htmlFor={`score-${criterion.id}`} className="text-xs font-bold text-slate-500">Score (max {Number(criterion.maxScore)})</label><input id={`score-${criterion.id}`} type="number" min="0" max={Number(criterion.maxScore)} step="0.01" value={criterionScores[criterion.id] ?? ""} onChange={(event) => setCriterionScores((current) => ({ ...current, [criterion.id]: event.target.value === "" ? "" : Number(event.target.value) }))} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-lg font-extrabold text-[#102f49] outline-none focus:border-[#f6a800] focus:ring-2 focus:ring-amber-100" /></div></div>)}
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Panel recommendation<select value={activeRecommendation} onChange={(event) => setActiveRecommendation(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-[#f6a800]"><option value="APPROVE">Approve</option><option value="MINOR_REVISION">Minor revisions</option><option value="MAJOR_REVISION">Major revisions</option><option value="REJECT">Reject</option></select></label><label className="text-sm font-bold text-slate-700">Overall remarks<textarea value={activeRemarks} onChange={(event) => setActiveRemarks(event.target.value)} placeholder="Summarize strengths and required revisions" className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-[#f6a800]" /></label></div>
                        {evaluationError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{evaluationError}</div>}
                        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button onClick={() => handleSaveEvaluation(false)} disabled={isSavingEvaluation} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-extrabold text-[#173f63] disabled:opacity-50">Save draft</button><button onClick={() => { if (window.confirm("Submit this final evaluation? It will be locked and cannot be changed.")) handleSaveEvaluation(true); }} disabled={isSavingEvaluation} className="h-11 rounded-xl bg-[#f6a800] px-5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"><i className="ti ti-lock-check mr-2" />Submit final & lock</button></div>
                      </section>
                    )}
                  </>
                )}
              </div>
            ),
            grades: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Grades & Recommendations</h3>
                <p className="text-[11px] text-slate-400 font-bold">Monitor submitted grades, final marks, and panel consensus records.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {gradesSubmitted.map(g => (
                    <div key={g.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                      <div>
                        <span className="font-bold text-[#1b4264] block">{g.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Score: {g.score}{g.maximum ? ` / ${g.maximum}` : ""} · {String(g.recommendation || "No recommendation").replace(/_/g, " ")}</span>
                      </div>
                      <Tag variant="success">{g.status}</Tag>
                    </div>
                  ))}
                  {gradesSubmitted.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">No locked evaluations yet.</div>}
                </div>
              </div>
            ),
            history: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Archives</h3>
                <p className="text-[11px] text-slate-400 font-bold">Completed panel assignments with your evaluation and recommendation records.</p>
                <div className="mt-2 flex flex-col gap-3">
                  {archives.map((session: any) => {
                    const evaluation = session.evaluations?.[0];
                    const recommendation = session.recommendations?.[0];
                    return <div key={session.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><strong className="block text-[#1b4264]">{session.research.title}</strong><span className="mt-1 block text-[11px] text-slate-500">Completed {session.endedAt ? new Date(session.endedAt).toLocaleString() : "date unavailable"} · Official decision: {String(session.decision || "PENDING RELEASE").replace(/_/g, " ")}</span><span className="mt-1 block text-[11px] text-slate-500">Your score: {evaluation?.totalScore ?? "Not recorded"} · Recommendation form: {recommendation?.status || "Not submitted"}</span></div><Tag variant={session.decision === "REJECTED" ? "danger" : session.releasedAt ? "success" : "warn"}>{session.releasedAt ? "Released" : "Completed"}</Tag></div></div>;
                  })}
                  {archives.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">No completed defense assignments yet.</div>}
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
