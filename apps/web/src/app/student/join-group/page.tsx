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
      setTimeout(() => router.push("/student/dashboard?tab=group"), 700);
    } catch (error: any) {
      setMessage(error?.message || "This invitation could not be used.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <section className="w-full max-w-lg rounded-2xl border border-[#DDE3E8] dark:border-white/10 bg-white dark:bg-[#101b2b] p-7 sm:p-8 shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
          <i className="ti ti-users-plus text-2xl" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-black text-[#17212B] dark:text-white">
          Join a research group
        </h1>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Enter the invitation code shared by the group leader. You must leave any current group before joining another.
        </p>
        <form onSubmit={joinGroup} className="mt-6">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Invitation code
          </label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            maxLength={32}
            autoFocus
            placeholder="ENTER GROUP CODE"
            className="mt-2 w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] px-4 py-3 text-center font-mono text-lg font-bold uppercase tracking-widest text-[#17212B] dark:text-white outline-none focus:border-[#0B3A53] dark:focus:border-[#C9A227]"
          />
          {message && (
            <p
              className={`mt-3 rounded-xl p-3 text-xs sm:text-sm font-semibold ${
                message.startsWith("You joined")
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              }`}
            >
              {message}
            </p>
          )}
          <button
            disabled={!code.trim() || joining}
            className="mt-5 w-full rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] px-5 py-3 text-sm font-extrabold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {joining ? "Joining…" : "Join group"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/student/dashboard?tab=group")}
            className="mt-2 w-full rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
        </form>
      </section>
    </div>
  );
}
