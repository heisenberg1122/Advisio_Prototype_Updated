"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export default function JoinResearchGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState((searchParams.get("code") || "").toUpperCase());
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const joinGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setMessage(null);
    try {
      const response = await apiClient.post<{ project: { title: string; groupName?: string | null } }>(`/api/research/join/${code.trim().toUpperCase()}`);
      setMessage(`You joined ${response.project.groupName || response.project.title}.`);
      setTimeout(() => router.push("/dashboard?tab=group"), 700);
    } catch (error: any) {
      setMessage(error?.message || "This invitation could not be used.");
    } finally {
      setJoining(false);
    }
  };

  return <main className="grid min-h-[calc(100vh-64px)] place-items-center bg-slate-50 p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[#173f63]"><i className="ti ti-users-plus text-2xl" /></span><h1 className="mt-4 text-center text-2xl font-black text-[#102f49]">Join a research group</h1><p className="mt-2 text-center text-sm text-slate-500">Enter the invitation code shared by the group leader. You must leave any current group before joining another.</p><form onSubmit={joinGroup} className="mt-6"><label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Invitation code</label><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={32} autoFocus placeholder="Enter group code" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-lg font-bold uppercase tracking-widest outline-none focus:border-[#173f63]" />{message && <p className={`mt-3 rounded-lg p-3 text-sm font-semibold ${message.startsWith("You joined") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>}<button disabled={!code.trim() || joining} className="mt-4 w-full rounded-xl bg-[#f6a800] px-5 py-3 text-sm font-extrabold text-[#102f49] disabled:opacity-50">{joining ? "Joining…" : "Join group"}</button><button type="button" onClick={() => router.push("/dashboard?tab=group")} className="mt-2 w-full rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500">Cancel</button></form></section></main>;
}
