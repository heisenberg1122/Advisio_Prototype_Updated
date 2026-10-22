"use client";

import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDefense } from "@/hooks/use-student";
import { EligibilityBanner } from "@/components/defense/EligibilityBanner";
import { DefenseChecklist } from "@/components/defense/DefenseChecklist";
import { DefenseSkeleton } from "@/components/defense/DefenseSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useActiveProject } from "@/providers/active-project-provider";
import { SharedManuscriptFeedback } from "@/components/documents/SharedManuscriptFeedback";

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
  const projectSelection = useActiveProject(data?.projects || []);
  const preferredSession = data?.sessions.find((session: any) => activeStatuses.has(session.status)) || data?.sessions[0] || null;
  const selectedSession = sessionId ? data?.sessions.find((session: any) => session.id === sessionId) || null : preferredSession;
  const { data: packetData } = useQuery({
    queryKey: ["student-defense-packet", selectedSession?.id],
    queryFn: () => apiClient.get<{ packet: any }>(`/api/defense-sessions/${selectedSession.id}/review-packet`),
    enabled: Boolean(selectedSession?.id),
    retry: false,
  });
  const { data: packetHistoryData } = useQuery({
    queryKey: ["student-defense-packet-history", selectedSession?.id],
    queryFn: () => apiClient.get<{ publications: any[] }>(`/api/defense-sessions/${selectedSession.id}/review-packet/history`),
    enabled: Boolean(selectedSession?.id && packetData?.packet),
    retry: false,
  });
  const packet = packetData?.packet || null;

  useEffect(() => {
    if (!sessionId && preferredSession?.id) navigate(projectSelection.projectHref(`/student/defense/${preferredSession.id}`), { replace: true });
  }, [navigate, preferredSession?.id, projectSelection.projectHref, sessionId]);

  if (isPending) return <DefenseSkeleton />;
  if (isError || !data) return <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-extrabold">Defense information could not be loaded.</p><p className="mt-1">{error instanceof Error ? error.message : "Please try again."}</p><button type="button" onClick={() => refetch()} className="mt-3 font-extrabold underline">Retry</button></div></div>;
  if (!data.project) return <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><i className="ti ti-presentation-off text-4xl text-slate-300" /><h1 className="mt-3 text-xl font-extrabold text-[var(--color-text-primary)]">{data.projects.length ? "Select a research project" : "No research project yet"}</h1><p className="mt-2 text-sm text-slate-500">{projectSelection.invalidRequestedProjectId ? "That project is unavailable or you do not have access to it." : data.projects.length ? "Choose which project's defense information to view." : "Create or join a research project before tracking its defense."}</p>{data.projects.length ? <select aria-label="Research project" value="" onChange={(event) => projectSelection.selectProject(event.target.value || null)} className="mx-auto mt-5 block h-11 w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm font-semibold"><option value="">Choose a research project</option>{data.projects.map((project: any) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}</select> : <Link to="/student/dashboard?tab=group" className="mt-5 inline-flex rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white">Open My Projects</Link>}</div></div>;
  if (sessionId && !selectedSession) return <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"><h1 className="font-extrabold">Defense session not found</h1><p className="mt-1">This session is not assigned to your active research project, or it is no longer available.</p><button type="button" onClick={() => navigate(projectSelection.projectHref("/student/defense"))} className="mt-4 rounded-xl bg-[#173f63] px-4 py-2 text-xs font-extrabold text-white">Open my defense</button></div></div>;

  const invitations = (selectedSession?.invitations || []).filter((invitation: any) => invitation.status !== "REMOVED");
  const confirmed = invitations.filter((invitation: any) => invitation.status === "ACCEPTED").length;
  const researchers = (selectedSession?.research?.members || []).filter((member: any) => ["LEADER", "MEMBER"].includes(member.projectRole));
  const adviser = (selectedSession?.research?.members || []).find((member: any) => member.projectRole === "ADVISER")?.user || selectedSession?.research?.adviserRequests?.[0]?.adviser;
  const event = selectedSession?.defenseEvent;

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {selectedSession && <SharedManuscriptFeedback sessionId={selectedSession.id}/>}
      <section className="college-hero-surface flex flex-col justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-6 text-[var(--color-text-primary)] shadow-[var(--shadow-card-soft)] sm:p-7 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Research defense</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{event?.code || "Defense readiness"}</h1>
            {selectedSession && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(selectedSession.status)}`}>{readable(selectedSession.status)}</span>}
          </div>
          <p className="mt-1.5 max-w-3xl text-xs sm:text-sm text-[var(--color-text-secondary)]">{data.project.title}</p>
          {selectedSession && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)]">
              <span><strong className="text-[var(--color-text-primary)]">Professor event:</strong> {event?.code || "Legacy session"}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(selectedSession.id)} className="text-left hover:text-[var(--color-primary)] cursor-pointer">
                <strong className="text-[var(--color-text-primary)]">Group session ID:</strong> {selectedSession.id} <i className="ti ti-copy ml-1" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.projects.length > 1 && <select aria-label="Research project" value={data.project.id} onChange={(event) => projectSelection.selectProject(event.target.value)} className="h-10 max-w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold"><option value="" disabled>Select project</option>{data.projects.map((project: any) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}</select>}
          <Link to={projectSelection.projectHref("/student/dashboard?tab=group")} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] transition shadow-xs">Back to My Projects</Link>
        </div>
      </section>

      {!selectedSession && <><EligibilityBanner eligibility={data.eligibility} /><DefenseChecklist requirements={data.requirements} /><EmptyState
          size="md"
          icon="ti-calendar-time"
          title="No defense session has been created"
          description="Once every requirement is complete, the professor or coordinator can place your project into a defense event. The exact session will appear here automatically."
        /></>}

      {selectedSession && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
          { label: "Defense type", value: readable(event?.defenseType), icon: "ti-presentation" },
          { label: "Group schedule", value: selectedSession.scheduledStart ? new Date(selectedSession.scheduledStart).toLocaleString() : "To be announced", icon: "ti-calendar-event" },
          { label: "Queue", value: selectedSession.queuePosition ? `Position ${selectedSession.queuePosition} · ${readable(selectedSession.queueStatus)}` : readable(selectedSession.queueStatus), icon: "ti-list-numbers" },
          { label: "Panel", value: `${confirmed} of ${invitations.length} confirmed`, icon: "ti-users-group" },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]"><i className={`ti ${item.icon} text-xl text-[var(--color-primary)]`} /><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{item.value}</p></div>)}</section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Schedule and venue</h2><p className="mt-1 text-xs text-slate-500">This is the official slot created from {event?.code || "the professor defense session"}.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(selectedSession.queueStatus)}`}>{readable(selectedSession.queueStatus)}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold text-slate-400">Starts</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.scheduledStart ? new Date(selectedSession.scheduledStart).toLocaleString() : "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Ends</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.scheduledEnd ? new Date(selectedSession.scheduledEnd).toLocaleString() : "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Venue</dt><dd className="mt-1 font-extrabold text-slate-700">{selectedSession.venue || event?.venue || "To be announced"}</dd></div><div><dt className="text-xs font-bold text-slate-400">Research group</dt><dd className="mt-1 font-extrabold text-slate-700">{researchers.map((member: any) => `${member.user.firstName} ${member.user.lastName}`).join(", ")}</dd></div></dl>{(selectedSession.meetingUrl || event?.meetingUrl) && <a href={selectedSession.meetingUrl || event.meetingUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-xs font-semibold text-white transition"><i className="ti ti-video mr-1.5" />Open defense meeting</a>}</div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]"><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Defense panel</h2>{adviser && <p className="mt-1 text-xs text-slate-500">Adviser: <strong>{adviser.firstName} {adviser.lastName}</strong></p>}<div className="mt-4 space-y-2">{invitations.map((invitation: any) => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3 border border-[var(--color-border-subtle)]"><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{invitation.invitee.firstName} {invitation.invitee.lastName}</p><p className="text-[11px] text-slate-500">{readable(invitation.role)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${statusTone(invitation.status)}`}>{readable(invitation.status)}</span></div>)}{!invitations.length && <p className="rounded-xl bg-[var(--color-surface-muted)] p-4 border border-[var(--color-border-subtle)] text-xs text-slate-500">Panel assignments have not been published.</p>}</div></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Published defense manuscript</h2><p className="mt-1 text-xs text-slate-500">The exact immutable version published in this defense packet.</p></div>{packet?.manuscriptVersion && <Link to={projectSelection.projectHref(`/student/documents?documentId=${packet.manuscriptVersion.document.id}&versionId=${packet.manuscriptVersion.id}`)} className="rounded-xl border border-[#173f63] px-3 py-2 text-xs font-extrabold text-[var(--color-primary)]">Open version</Link>}</div>
            {packet?.manuscriptVersion ? <div className="mt-4 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4"><p className="font-bold text-[var(--color-text-primary)]">{packet.manuscriptVersion.document.title}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">Version {packet.manuscriptVersion.versionNumber} · {readable(packet.manuscriptVersion.manuscriptStatus)} · {packet.manuscriptVersion.isImmutable ? "Frozen submission" : "Working version"}</p><p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Published {packet.publishedAt ? new Date(packet.publishedAt).toLocaleString() : "date unavailable"}{packetHistoryData?.publications?.length ? ` · ${packetHistoryData.publications.length} publication record${packetHistoryData.publications.length === 1 ? "" : "s"}` : ""}</p></div> : <p className="mt-4 rounded-xl bg-[var(--color-surface-muted)] p-4 text-xs text-slate-500">No published defense manuscript packet is available for this session yet.</p>}
            <div className="mt-5 border-t border-[var(--color-border)] pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[var(--color-text-primary)]">Related project documents</h3><Link to={projectSelection.projectHref("/student/documents")} className="text-xs font-bold text-[var(--color-primary)]">Open all</Link></div><div className="mt-3 space-y-2">{data.documents.filter((document: any) => document.id !== packet?.manuscriptVersion?.document.id).slice(0, 3).map((document: any) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3 border border-[var(--color-border-subtle)]"><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{document.title}</p><p className="text-[11px] text-slate-500">{readable(document.documentType)} · Version {document.currentVersion}</p></div><i className="ti ti-file-text text-lg text-slate-400" /></div>)}</div></div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]"><h2 className="text-lg font-bold text-[var(--color-text-primary)]">Official result</h2>{selectedSession.releasedAt ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Released result</p><p className="mt-2 text-lg font-black text-emerald-900">{readable(selectedSession.decision)}</p><p className="mt-1 text-xs text-emerald-700">Released {new Date(selectedSession.releasedAt).toLocaleString()}</p></div> : <div className="mt-4 rounded-xl bg-[var(--color-surface-muted)] p-4 border border-[var(--color-border-subtle)]"><p className="font-extrabold text-slate-700">Result not released</p><p className="mt-1 text-xs leading-5 text-slate-500">Panel evaluations remain private until the professor or coordinator releases the official decision.</p></div>}</div>
        </section>
      </>}

      {data.sessions.length > 1 && <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]"><h2 className="text-lg font-extrabold text-[var(--color-text-primary)]">Defense session history</h2><div className="mt-4 space-y-2">{data.sessions.map((session: any) => <Link key={session.id} to={projectSelection.projectHref(`/student/defense/${session.id}`)} className={`flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${session.id === selectedSession?.id ? "border-[var(--color-primary)] bg-[var(--color-surface)]" : "border-[var(--color-border)] bg-[var(--color-surface-muted)]"}`}><div><p className="font-extrabold text-[var(--color-text-primary)]">{session.defenseEvent?.code || `Session ${session.id.slice(0, 8)}`}</p><p className="mt-1 text-xs text-slate-500">{session.scheduledStart ? new Date(session.scheduledStart).toLocaleString() : "Schedule unavailable"}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(session.status)}`}>{readable(session.status)}</span></Link>)}</div></section>}
    </div>
  );
}
