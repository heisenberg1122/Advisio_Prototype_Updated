import React, { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/providers/theme-provider";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

function PanelistDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: researchData } = useQuery({
    queryKey: ["panelist-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research").catch(() => ({ projects: [] })),
    staleTime: 60000,
  });

  const { data: liveData, isLoading: liveLoading, error: liveError } = useQuery({
    queryKey: ["active-defense-session"],
    queryFn: () => apiClient.get<{ session: any | null }>("/api/defense-sessions/active"),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
  const liveSession = liveData?.session || null;
  const { data: defenseManagementData } = useQuery({
    queryKey: ["panelist-defense-management"],
    queryFn: () => apiClient.get<{ sessions: any[] }>("/api/defense-management"),
    refetchInterval: 15000,
  });

  const { data: templateData } = useQuery({
    queryKey: ["evaluation-templates", liveSession?.research?.researchTypeId],
    queryFn: () => apiClient.get<{ templates: any[] }>("/api/evaluation-templates", { params: { researchTypeId: liveSession.research.researchTypeId } }),
    enabled: Boolean(liveSession?.research?.researchTypeId),
  });
  const activeTemplate = templateData?.templates?.[0] || null;

  // Real State Data with live fallbacks
  const [schedules, setSchedules] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [gradesSubmitted, setGradesSubmitted] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [criterionScores, setCriterionScores] = useState<Record<string, number | "">>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [activeRecommendation, setActiveRecommendation] = useState("APPROVE");
  const [activeRemarks, setActiveRemarks] = useState("");
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [respondingInvitation, setRespondingInvitation] = useState<any | null>(null);
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

  useEffect(() => {
    setSchedules((defenseManagementData?.sessions || []).map((session: any) => ({
      ...session,
      title: session.research?.title,
      date: session.scheduledStart ? new Date(session.scheduledStart).toLocaleDateString() : "Pending",
      time: session.scheduledStart ? new Date(session.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Awaiting schedule",
      venue: session.venue || (session.meetingUrl ? "Online" : "To be announced"),
      type: session.status.replace(/_/g, " "),
      myInvitation: session.invitations?.[0] || null,
    })));
  }, [defenseManagementData]);

  useEffect(() => {
    if (!liveSession) return;
    setDocuments((liveSession.research?.documents || []).map((document: any) => ({ ...document, group: liveSession.research.title, status: "Available" })));
    setEvaluations(liveSession.evaluations?.[0]?.status === "LOCKED" ? [] : [{ id: liveSession.id, title: liveSession.research.title }]);
    setGradesSubmitted(liveSession.evaluations?.filter((item: any) => item.status === "LOCKED").map((item: any) => ({ id: item.id, title: liveSession.research.title, score: Number(item.totalScore), status: "locked" })) || []);
  }, [liveSession]);

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
      await queryClient.invalidateQueries({ queryKey: ["panelist-defense-management"] });
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
      await apiClient.put(`/api/defense-sessions/${liveSession.id}/evaluation`, {
        templateId: activeTemplate.id,
        recommendation: activeRecommendation,
        remarks: activeRemarks,
        final,
        criteriaScores: activeTemplate.criteria.map((criterion: any) => ({ criterionId: criterion.id, score: criterionScores[criterion.id], comment: criterionComments[criterion.id] || "" })),
      });
      await queryClient.invalidateQueries({ queryKey: ["active-defense-session"] });
      triggerToast(final ? "Final evaluation submitted and locked." : "Evaluation draft saved securely.");
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

  const tabsList = [
    { id: "overview", label: "Overview", icon: "ti-layout-dashboard" },
    { id: "schedule", label: "Defense Schedules", icon: "ti-calendar-event", badge: schedules.length },
    { id: "documents", label: "Manuscript Reviews", icon: "ti-file-text", badge: documents.length },
    { id: "evaluations", label: "Evaluations & Scoring", icon: "ti-certificate", badge: evaluations.length },
    { id: "grades", label: "Grades & Recommendations", icon: "ti-clipboard-check", badge: gradesSubmitted.length },
    { id: "history", label: "Defense Archives", icon: "ti-history" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen text-slate-800 bg-slate-50 font-sans">
      
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border-l-4 border-[#ffa400] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      {respondingInvitation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="decline-defense-title"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-wider text-rose-600">Availability response</p><h2 id="decline-defense-title" className="mt-1 text-xl font-extrabold text-[#102f49]">Cannot attend this schedule?</h2><p className="mt-1 text-sm text-slate-500">Your reason is shared with the professor, not the research group.</p></div><button type="button" onClick={() => setRespondingInvitation(null)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><i className="ti ti-x" /></button></div><label className="mt-5 block text-sm font-bold text-slate-700">Reason<textarea required value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} rows={4} placeholder="Explain why you are unavailable…" className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label><label className="mt-4 block text-sm font-bold text-slate-700">Suggested alternative <span className="font-normal text-slate-400">(optional)</span><input type="datetime-local" value={suggestedAvailability} onChange={(event) => setSuggestedAvailability(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRespondingInvitation(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Keep invitation</button><button type="button" onClick={() => respondToInvitation(respondingInvitation, "DECLINED")} disabled={invitationSaving || !declineReason.trim()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Decline and notify professor</button></div></div></div>}

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto bg-[#f6f8fb] p-5 lg:p-6">
        
        {(() => {
          const tabTitles: Record<string, string> = {
            overview: "Panelist Dashboard",
            schedule: "Defense Schedule Management",
            documents: "Submitted Research Documents",
            evaluation: "Digital Evaluation & Scoring Sheets",
            grades: "Grades & Recommendations",
            history: "Historical Grading Records",
            settings: "Settings",
          };

          const tabContent: Record<string, React.ReactNode> = {
            overview: (
              <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
                <section className="relative min-h-[176px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-[0_1px_3px_rgba(15,47,73,0.04)] lg:px-8"><div className="relative z-10 max-w-2xl"><h2 className="text-[26px] font-extrabold tracking-tight text-[#102f49] lg:text-[30px]">Good morning, Panelist</h2><p className="mt-1 text-[15px] text-slate-500">Review assigned defenses and complete evaluations with confidence.</p><button onClick={() => handleTabChange("evaluation")} className="mt-5 inline-flex h-12 items-center gap-3 rounded-xl bg-[#f6a800] px-6 text-[15px] font-extrabold text-[#102f49]"><i className="ti ti-clipboard-check text-xl" /> Start evaluation</button></div><div className="absolute bottom-0 right-12 hidden h-full w-[38%] items-center justify-center lg:flex" aria-hidden="true"><div className="absolute h-32 w-72 rounded-[50%] bg-[#f2f6fa]" /><div className="relative flex items-end gap-5"><div className="space-y-2"><div className="h-5 w-36 rounded bg-[#173f63]" /><div className="h-4 w-28 rounded bg-[#f6a800]" /><div className="h-5 w-40 rounded bg-[#244e70]" /></div><i className="ti ti-award text-[94px] text-[#173f63]" /></div></div></section>
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
                  { label: "Defense panels", value: `${schedules.length} assigned`, icon: "ti-calendar-event", tone: "bg-blue-50 text-[#173f63]", tab: "schedule" }, { label: "Documents", value: `${documents.length} available`, icon: "ti-file-text", tone: "bg-amber-50 text-[#d98d00]", tab: "documents" }, { label: "Evaluations", value: `${evaluations.length} pending`, icon: "ti-clipboard-check", tone: "bg-rose-50 text-rose-600", tab: "evaluation" }, { label: "Submitted", value: `${gradesSubmitted.length} results`, icon: "ti-circle-check", tone: "bg-emerald-50 text-emerald-600", tab: "grades" },
                ].map((item) => <button key={item.label} onClick={() => handleTabChange(item.tab)} className="flex min-h-[102px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,47,73,0.04)] transition hover:border-[#f6a800]"><span className={`flex h-14 w-14 items-center justify-center rounded-xl ${item.tone}`}><i className={`ti ${item.icon} text-[26px]`} /></span><span><span className="block text-[13px] text-slate-500">{item.label}</span><span className="mt-1 block text-[18px] font-extrabold text-[#102f49]">{item.value}</span></span></button>)}</section>
                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.95fr]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="text-[18px] font-extrabold text-[#102f49]">Upcoming Defenses</h3><p className="mt-0.5 text-sm text-slate-500">Your next assigned panel sessions.</p></div><button onClick={() => handleTabChange("schedule")} className="text-sm font-bold text-[#173f63]">View schedule <i className="ti ti-chevron-right" /></button></div><div className="mt-5 space-y-3">{schedules.length ? schedules.slice(0, 3).map((s) => <button key={s.id} onClick={() => handleTabChange("schedule")} className="flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left"><span className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-white text-[#173f63]"><i className="ti ti-calendar text-xl" /></span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-[#102f49]">{s.title}</span><span className="mt-0.5 block text-xs text-slate-500">{s.date} · {s.time} · {s.venue}</span></span><i className="ti ti-chevron-right text-slate-400" /></button>) : <div className="flex min-h-40 flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#173f63]"><i className="ti ti-calendar-time text-2xl" /></span><p className="mt-3 font-bold text-[#102f49]">No defenses scheduled</p><p className="mt-1 text-xs text-slate-500">New panel assignments will appear here.</p></div>}</div></article>
                  <article className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-[18px] font-extrabold text-[#102f49]">Evaluation Queue</h3><p className="mt-0.5 text-sm text-slate-500">Research groups waiting for your score.</p><div className="mt-5 space-y-3">{evaluations.length ? evaluations.slice(0, 3).map((e) => <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"><span className="min-w-0"><span className="block truncate font-bold text-[#102f49]">{e.title}</span><span className="text-xs text-slate-500">Ready for evaluation</span></span><button onClick={() => handleTabChange("evaluation")} className="ml-3 rounded-lg bg-[#f6a800] px-3 py-2 text-xs font-extrabold text-[#102f49]">Evaluate</button></div>) : <div className="flex min-h-40 flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><i className="ti ti-circle-check text-2xl" /></span><p className="mt-3 font-bold text-[#102f49]">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">New evaluation sheets will appear here.</p></div>}</div></article>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-[18px] font-extrabold text-[#102f49]">Quick Actions</h3><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{[
                  { label: "View schedule", icon: "ti-calendar-event", tab: "schedule" }, { label: "Review documents", icon: "ti-file-search", tab: "documents" }, { label: "Score defense", icon: "ti-clipboard-check", tab: "evaluation" }, { label: "View results", icon: "ti-award", tab: "grades" },
                ].map((action) => <button key={action.label} onClick={() => handleTabChange(action.tab)} className="flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#f6a800]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-xl text-[#173f63]"><i className={`ti ${action.icon}`} /></span><span className="text-sm font-bold text-[#102f49]">{action.label}</span></button>)}</div></section>
              </div>
            ),
            "overview-legacy": (
              <>
                {/* EXACT PANELIST CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-calendar" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Assigned Defense Schedules</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{schedules.length} Panels</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-file-text" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Submitted Research Docs</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{documents.length} Files</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#ffa400] flex items-center justify-center text-lg">
                      <i className="ti ti-stars" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Pending Evaluation Sheets</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{evaluations.length} Pending</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#1b4264]/10 text-[#1b4264] flex items-center justify-center text-lg">
                      <i className="ti ti-circle-check" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Grades Submitted</span>
                      <span className="text-[18px] font-extrabold text-[#1b4264]">{gradesSubmitted.length} Grades</span>
                    </div>
                  </div>
                </div>

                {/* Quick summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Assigned Defense Schedules</h3>
                    <div className="flex flex-col gap-2.5">
                      {schedules.length > 0 ? (
                        schedules.map(s => (
                          <div key={s.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center shadow-sm">
                            <div>
                              <span className="font-bold text-[#1b4264] block">{s.title}</span>
                              <span className="text-[10px] text-slate-450">{s.date} · {s.time} ({s.venue})</span>
                            </div>
                            <Tag variant="warn">{s.type}</Tag>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          No assigned defense schedules.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-extrabold text-[#1b4264] text-[14px]">Pending Digital Evaluations</h3>
                    <div className="flex flex-col gap-2.5">
                      {evaluations.length > 0 ? (
                        evaluations.map(e => (
                          <div key={e.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[12px] flex justify-between items-center shadow-sm">
                            <span>{e.title}</span>
                            <button onClick={()=>triggerToast("Opening evaluation rubric sheet.")} className="px-2.5 py-1 bg-[#ffa400] text-[#1b4264] font-extrabold text-[10px] rounded border border-[#ffa400] cursor-pointer">
                              Evaluate
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          No pending digital evaluations.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ),
            schedule: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Defense Schedule Management</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review defense panel timings, assignees, and digital venues.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {schedules.length > 0 ? (
                    schedules.map(s => (
                      <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="block font-bold text-[#1b4264]">{s.title}</span><span className="text-[11px] text-slate-500">{s.date} at {s.time} · Venue: {s.venue}</span><span className="mt-1 block text-[11px] font-bold text-slate-600">Invited as {s.myInvitation?.role?.replace(/_/g, " ")}</span></div><Tag variant={s.status === "SCHEDULED" ? "success" : s.status === "NEEDS_RESCHEDULING" ? "danger" : "warn"}>{s.type}</Tag></div>
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Submitted Research Documents</h3>
                <p className="text-[11px] text-slate-400 font-bold">Review draft submissions, download version histories, and checklist files.</p>
                <div className="flex flex-col gap-3 mt-2">
                  {documents.length > 0 ? (
                    documents.map(d => (
                      <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-[12.5px] shadow-sm">
                        <div>
                          <span className="font-bold text-[#1b4264] block">{d.title}</span>
                          <span className="text-[11px] text-slate-500">{d.group}</span>
                        </div>
                        <span className="text-[11px] font-bold text-[#ffa400]">{d.status}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No submitted research documents assigned for panel review.
                    </div>
                  )}
                </div>
              </div>
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
                        <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-extrabold text-[#1b4264]">{activeTemplate.name}</h3><p className="mt-1 text-sm text-slate-500">Enter each criterion score. Drafts remain editable; final submission is permanently locked.</p></div><Tag variant="warn">Draft</Tag></div>
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
                        <span className="text-[10px] text-slate-400 font-mono">Score: {g.score}</span>
                      </div>
                      <Tag variant="success">{g.status}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            ),
            history: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Historical Grading Records</h3>
                <p className="text-[11px] text-slate-400 font-bold">Access historical transcripts, previous semester grading sheets, and archives.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 shadow-sm text-slate-650 flex flex-col gap-2">
                  <div><strong>Total Historical Panels:</strong> 12 Panels</div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="text-[11.5px] font-medium flex flex-col gap-2">
                    <div>1. SECURE DECENTRALIZED GRADING SYSTEM (A.Y. 2025 CS) — Passed (94)</div>
                    <div>2. IOT SMART HOME HUB SECURITY (A.Y. 2025 IT) — Passed (91)</div>
                  </div>
                </div>
              </div>
            ),
            settings: (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-[#1b4264] text-[16px]">Portal Settings</h3>
                <p className="text-[11px] text-slate-400 font-bold">Manage your notification channels, credentials, and theme settings.</p>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[12.5px] mt-2 flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Email Notifications</span>
                      <span className="text-[10px] text-slate-400">Receive system notifications via email address.</span>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-[#ffa400] w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#1b4264] block">Dark Mode</span>
                      <span className="text-[10px] text-slate-400">Switch platform styling theme to night vision.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={toggleTheme}
                      className="accent-[#ffa400] w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ),
          };

          return tabContent[activeTab] || tabContent.overview;
        })()}

      </main>

    </div>
  );
}

export default function PanelistDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Panelist Dashboard...</div>}>
      <PanelistDashboardContent />
    </Suspense>
  );
}
