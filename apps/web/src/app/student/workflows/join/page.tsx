import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";

export default function JoinWorkflowPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [workflow, setWorkflow] = useState<any | null>(null);

  const join = async () => {
    setJoining(true);
    setError("");
    try {
      const result = await apiClient.post<{ workflow: any }>(`/api/workflows/join/${code}`, {});
      setWorkflow(result.workflow);
    } catch (caught: any) {
      setError(caught?.message || "This workflow invitation could not be accepted.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {!workflow ? (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-xl text-[#173f63]"><i className="ti ti-route" /></span>
            <h1 className="mt-4 text-2xl font-black text-[#102f49]">Join research workflow</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Accept this invitation to receive the professor&apos;s milestones and tasks. Your progress begins individually; milestones will indicate whether work is individual, group-based, or either.</p>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><span className="text-slate-500">Invitation code</span><strong className="ml-2 font-mono text-[#102f49]">{code.toUpperCase()}</strong></div>
            {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => navigate("/student/dashboard")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              <button type="button" onClick={() => void join()} disabled={joining || !code} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{joining ? "Joining…" : "Join workflow"}</button>
            </div>
          </>
        ) : (
          <>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-700"><i className="ti ti-check" /></span>
            <h1 className="mt-4 text-2xl font-black text-[#102f49]">You joined {workflow.name}</h1>
            <p className="mt-2 text-sm text-slate-600">The workflow milestones are now available to you.</p>
            <div className="mt-6 space-y-2">{workflow.stages?.map((stage: any, index: number) => <div key={stage.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-black">{index + 1}</span><span className="flex-1"><strong className="block text-sm text-[#102f49]">{stage.name}</strong><span className="text-xs text-slate-500">{stage.submissionMode === "INDIVIDUAL" ? "Individual" : stage.submissionMode === "GROUP" ? "Group" : "Individual or group"}</span></span></div>)}</div>
            <button type="button" onClick={() => navigate("/student/dashboard")} className="mt-6 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white">Go to dashboard</button>
          </>
        )}
      </section>
    </main>
  );
}
