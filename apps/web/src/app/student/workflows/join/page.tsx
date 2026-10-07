import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function JoinWorkflowPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const { data, isPending, isError } = useQuery({
    queryKey: ["workflow-invitation", code],
    queryFn: () => apiClient.get<{ invitation: any }>(`/api/workflows/invitation/${code}`),
    retry: false,
  });
  const invitation = data?.invitation;

  const join = async () => {
    setJoining(true);
    setError("");
    try {
      const result = await apiClient.post<{ workflow: any }>(`/api/workflows/join/${code}`, {});
      await queryClient.invalidateQueries({ queryKey: ["student", "workflow-enrollments"] });
      navigate(`/student/tasks?workflowAccepted=${encodeURIComponent(result.workflow.name)}`, { replace: true });
    } catch (caught: any) {
      setError(caught?.message || "This workflow invitation could not be accepted.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {isPending ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-500"><i className="ti ti-loader-2 mr-2 animate-spin" />Checking invitation…</div>
        ) : isError || !invitation ? (
          <div className="py-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700"><i className="ti ti-link-off text-xl" /></span><h1 className="mt-4 text-xl font-black text-[#102f49]">Invitation unavailable</h1><p className="mt-2 text-sm text-slate-600">This workflow link is invalid, expired, or unavailable to your account.</p><button type="button" onClick={() => navigate("/student/tasks", { replace: true })} className="mt-6 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white">Go to Tasks & Requirements</button></div>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-xl text-[#173f63]"><i className="ti ti-route" /></span>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">Workflow invitation</p>
            <h1 className="mt-1 text-2xl font-black text-[#102f49]">You have been invited to join “{invitation.name}”</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Would you like to accept this invitation and receive the professor&apos;s milestones and task requirements?</p>
            <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Professor</span><strong className="mt-1 block text-[#102f49]">{`${invitation.professor?.firstName || ""} ${invitation.professor?.lastName || ""}`.trim() || invitation.professor?.email}</strong></div><div><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Milestones</span><strong className="mt-1 block text-[#102f49]">{invitation.stages?.length || 0} requirements stages</strong></div></div>
            {invitation.description && <p className="mt-4 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">{invitation.description}</p>}
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><span className="text-slate-500">Invitation code</span><strong className="ml-2 font-mono text-[#102f49]">{code.toUpperCase()}</strong></div>
            {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
            {invitation.alreadyJoined ? (
              <div className="mt-6"><p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">You have already accepted this workflow invitation.</p><button type="button" onClick={() => navigate("/student/tasks", { replace: true })} className="mt-3 w-full rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white">View Tasks & Requirements</button></div>
            ) : (
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => navigate("/student/tasks?invitation=declined", { replace: true })} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Reject</button>
                <button type="button" onClick={() => void join()} disabled={joining || !code} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{joining ? "Accepting…" : "Accept invitation"}</button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
