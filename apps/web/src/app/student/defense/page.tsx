"use client";

import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDefense } from "@/hooks/use-student";
import { EligibilityBanner } from "@/components/defense/EligibilityBanner";
import { DefenseChecklist } from "@/components/defense/DefenseChecklist";
import { DefenseSkeleton } from "@/components/defense/DefenseSkeleton";

const activeStatuses = new Set(["LIVE", "DELIBERATION", "SCHEDULED", "PENDING_ACKNOWLEDGEMENT", "NEEDS_RESCHEDULING"]);
const readable = (value?: string | null) => value ? value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()) : "Not available";
const statusTone = (status?: string) => {
  if (["SCHEDULED", "COMPLETED", "ACCEPTED"].includes(status || "")) return "bg-emerald-100 text-emerald-800";
  if (["LIVE", "IN_PROGRESS", "PREPARE_NEXT"].includes(status || "")) return "bg-blue-100 text-blue-800";
  if (["NEEDS_RESCHEDULING", "REJECTED", "DECLINED", "CANCELLED"].includes(status || "")) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
};

export default function DefensePage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useDefense();
  const preferredSession = data?.sessions.find((session: any) => activeStatuses.has(session.status)) || data?.sessions[0] || null;
  const selectedSession = sessionId ? data?.sessions.find((session: any) => session.id === sessionId) || null : preferredSession;

  useEffect(() => {
    if (!sessionId && preferredSession?.id) navigate(`/student/defense/${preferredSession.id}`, { replace: true });
  }, [navigate, preferredSession?.id, sessionId]);

  if (isPending) return <DefenseSkeleton />;
  if (isError || !data) return <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-extrabold">Defense information could not be loaded.</p><p className="mt-1">{error instanceof Error ? error.message : "Please try again."}</p><button type="button" onClick={() => refetch()} className="mt-3 font-extrabold underline">Retry</button></div></div>;
  if (!data.project) return <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><i className="ti ti-presentation-off text-4xl text-slate-300" /><h1 className="mt-3 text-xl font-extrabold text-[#102f49]">No research project yet</h1><p className="mt-2 text-sm text-slate-500">Create or join a research project before tracking its defense.</p><Link to="/student/dashboard?tab=group" className="mt-5 inline-flex rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white">Open My Projects</Link></div></div>;
  if (sessionId && !selectedSession) return <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"><h1 className="font-extrabold">Defense session not found</h1><p className="mt-1">This session is not assigned to your active research project, or it is no longer available.</p><button type="button" onClick={() => navigate("/student/defense")} className="mt-4 rounded-xl bg-[#173f63] px-4 py-2 text-xs font-extrabold text-white">Open my defense</button></div></div>;

  const invitations = (selectedSession?.invitations || []).filter((invitation: any) => invitation.status !== "REMOVED");
  const confirmed = invitations.filter((invitation: any) => invitation.status === "ACCEPTED").length;
  const researchers = (selectedSession?.research?.members || []).filter((member: any) => ["LEADER", "MEMBER"].includes(member.projectRole));
  const adviser = (selectedSession?.research?.members || []).find((member: any) => member.projectRole === "ADVISER")?.user || selectedSession?.research?.adviserRequests?.[0]?.adviser;
  const event = selectedSession?.defenseEvent;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl bg-[#102f49] p-6 text-white shadow-sm sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#f6a800]">Research defense</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">{event?.code || "Defense readiness"}</h1>{selectedSession && <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(selectedSession.status)}`}>{readable(selectedSession.status)}</span>}</div><p className="mt-2 max-w-3xl text-sm text-blue-100">{data.project.title}</p>{selectedSession && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-blue-100"><span><strong className="text-white">Professor event:</strong> {event?.code || "Legacy session"}</span><button type="button" onClick={() => navigator.clipboard.writeText(selectedSession.id)} className="text-left hover:text-white"><strong className="text-white">Group session ID:</strong> {selectedSession.id} <i className="ti ti-copy ml-1" /></button></div>}</div><Link to="/student/dashboard?tab=group" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/25 px-4 py-2.5 text-xs font-extrabold hover:bg-white/10">Back to My Projects</Link></div></section>

      {!selectedSession && <><EligibilityBanner eligibility={data.eligibility} /><DefenseChecklist requirements={data.requirements} /><section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><i className="ti ti-calendar-time text-4xl text-slate-300" /><h2 className="mt-3 font-extrabold text-[#102f49]">No defense session has been created</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">Once every requirement is complete, the professor or coordinator can place your project into a defense event. The exact professor-created session will appear here automatically.</p></section></>}

      {selectedSession && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
          { label: "Defense type", value: readable(event?.defenseType), icon: "ti-presentation" },
          { label: "Group schedule", value: selectedSession.scheduledStart ? new Date(selectedSession.scheduledStart).toLocaleString() : "To be announced", icon: "ti-calendar-event" },
          { label: "Queue", value: selectedSession.queuePosition ? `Position ${selectedSession.queuePosition} · ${readable(selectedSession.queueStatus)}` : readable(selectedSession.queueStatus), icon: "ti-list-numbers" },
          { label: "Panel", value: `${confirmed} of ${invitations.length} confirmed`, icon: "ti-users-group" },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><i className={`ti ${item.icon} text-xl text-[#173f63]`} /><p className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{item.label}</p><p className="mt-1 text-sm font-extrabold text-[#102f49]">{item.value}</p></div>)}</section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-[#102f49]">Schedule and venue</h2><p className="mt-1 text-xs text-slate-500">This is the official slot created from {event?.code || "the professor defense session"}.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(selectedSession.queueStatus)}`}>{readable(selectedSession.queueStatus)}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold text-slate-400">Starts</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.scheduledStart ? new Date(selectedSession.scheduledStart).toLocaleString() : "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Ends</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.scheduledEnd ? new Date(selectedSession.scheduledEnd).toLocaleString() : "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Venue</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.venue || event?.venue || "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Research group</dt><dd className="mt-1 font-extrabold text-slate-700">{researchers.map((member: any) => `${member.user.firstName} ${member.user.lastName}`).join(", ")}</dd></div></dl>{(selectedSession.meetingUrl || event?.meetingUrl) && <a href={selectedSession.meetingUrl || event.meetingUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-[#f6a800] px-4 py-2.5 text-xs font-extrabold text-[#102f49]"><i className="ti ti-video mr-1.5" />Open defense meeting</a>}</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-[#102f49]">Defense panel</h2>{adviser && <p className="mt-1 text-xs text-slate-500">Adviser: <strong>{adviser.firstName} {adviser.lastName}</strong></p>}<div className="mt-4 space-y-2">{invitations.map((invitation: any) => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#102f49]">{invitation.invitee.firstName} {invitation.invitee.lastName}</p><p className="text-[11px] text-slate-500">{readable(invitation.role)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${statusTone(invitation.status)}`}>{readable(invitation.status)}</span></div>)}{!invitations.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Panel assignments have not been published.</p>}</div></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-[#102f49]">Defense materials</h2><p className="mt-1 text-xs text-slate-500">Your project files remain in the document workspace.</p></div><Link to="/student/documents" className="rounded-xl border border-[#173f63] px-3 py-2 text-xs font-extrabold text-[#173f63]">Open documents</Link></div><div className="mt-4 space-y-2">{data.documents.slice(0, 5).map((document: any) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#102f49]">{document.title}</p><p className="text-[11px] text-slate-500">{readable(document.documentType)} · Version {document.currentVersion}</p></div><i className="ti ti-file-type-pdf text-lg text-rose-500" /></div>)}{!data.documents.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No defense materials are available yet.</p>}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-[#102f49]">Official result</h2>{selectedSession.releasedAt ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Released result</p><p className="mt-2 text-lg font-black text-emerald-900">{readable(selectedSession.decision)}</p><p className="mt-1 text-xs text-emerald-700">Released {new Date(selectedSession.releasedAt).toLocaleString()}</p></div> : <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="font-extrabold text-slate-700">Result not released</p><p className="mt-1 text-xs leading-5 text-slate-500">Panel evaluations remain private until the professor or coordinator releases the official decision.</p></div>}</div>
        </section>
      </>}

      {data.sessions.length > 1 && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-[#102f49]">Defense session history</h2><div className="mt-4 space-y-2">{data.sessions.map((session: any) => <Link key={session.id} to={`/student/defense/${session.id}`} className={`flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${session.id === selectedSession?.id ? "border-[#173f63] bg-blue-50" : "border-slate-200 bg-slate-50"}`}><div><p className="font-extrabold text-[#102f49]">{session.defenseEvent?.code || `Session ${session.id.slice(0, 8)}`}</p><p className="mt-1 text-xs text-slate-500">{session.scheduledStart ? new Date(session.scheduledStart).toLocaleString() : "Schedule unavailable"}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(session.status)}`}>{readable(session.status)}</span></Link>)}</div></section>}
    </div>
  );
}
