"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const personName = (person: any) =>
  person
    ? [person.firstName, person.lastName].filter(Boolean).join(" ")
    : "Not assigned";

export default function JoinResearchGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(
    (searchParams.get("code") || "").toUpperCase(),
  );
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewKind, setPreviewKind] = useState<"project" | "workspace">("project");

  const reviewGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMessage(null);
    setPreview(null);
    setPreviewKind("project");
    try {
      const response = await apiClient.get<{ project: any }>(
        `/api/research/join/${code.trim().toUpperCase()}/preview`,
      );
      setPreview(response.project);
      setPreviewKind("project");
    } catch (error: any) {
      try {
        const response = await apiClient.get<{ workspace: any }>(`/api/workspaces/join/${code.trim().toUpperCase()}/preview`);
        setPreview(response.workspace);
        setPreviewKind("workspace");
      } catch {
        setMessage(error?.message || "This group code could not be found.");
      }
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!preview) return;
    setJoining(true);
    setMessage(null);
    try {
      const response = previewKind === "workspace" ? await apiClient.post<{ workspace: { name: string } }>(`/api/workspaces/join/${code.trim().toUpperCase()}`) : await apiClient.post<{
        pendingApproval?: boolean;
        project: { title: string; groupName?: string | null };
      }>(`/api/research/join/${code.trim().toUpperCase()}`);
      const name = previewKind === "workspace" ? (response as { workspace: { name: string } }).workspace.name : ((response as { project: { title: string; groupName?: string | null } }).project.groupName || (response as { project: { title: string } }).project.title);
      setSuccess(true);
      if (previewKind === "workspace") {
        setMessage(`You joined ${name}. Add the research project when your group is ready.`);
        setTimeout(() => router.push("/student/dashboard?tab=group"), 900);
      } else if ((response as { pendingApproval?: boolean }).pendingApproval) {
        setMessage(`Your request to join ${name} was sent to the group leader.`);
      } else {
        setMessage(`You joined ${name}.`);
        setTimeout(() => router.push("/student/dashboard?tab=group"), 900);
      }
    } catch (error: any) {
      setMessage(error?.message || "This invitation could not be used.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
      <section className="w-full max-w-2xl rounded-2xl border border-[#DDE3E8] bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#101b2b] sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
          <i className="ti ti-users-plus text-2xl" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-black text-[#17212B] dark:text-white">
          Join a research group
        </h1>
        <p className="mt-2 text-center text-base text-slate-500 dark:text-slate-400 sm:text-base">
          Enter the code from the group leader, review the project, then confirm
          whether you want to join.
        </p>

        {!preview ? (
          <form onSubmit={reviewGroup} className="mt-6">
            <label className="text-sm font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Research group code
            </label>
            <input
              value={code}
              onChange={(event) => {
                setCode(
                  event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                );
                setMessage(null);
              }}
              maxLength={32}
              autoFocus
              placeholder="ENTER GROUP CODE"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-lg font-bold uppercase tracking-widest text-[#17212B] outline-none focus:border-[#0B3A53] dark:border-white/20 dark:bg-[#0B1726] dark:text-white dark:focus:border-[#C9A227]"
            />
            <button
              disabled={!code.trim() || loading}
              className="mt-5 w-full rounded-xl bg-[#0B3A53] px-5 py-3 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#072A3D] disabled:opacity-50"
            >
              {loading ? "Checking…" : "Review group"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-[#C58A18]">
                    {previewKind === "workspace" ? "Workspace preview" : "Group preview"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-[#17212B] dark:text-white">
                    {preview.groupName || "Research group"}
                  </h2>
                  <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
                    {previewKind === "workspace" ? `${preview.projectCount || 0} research projects` : preview.title}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-extrabold text-blue-800">
                  {preview.accessMode === "PUBLIC_APPROVAL"
                    ? "Leader approval required"
                    : preview.accessMode === "PUBLIC_OPEN"
                      ? "Open group"
                      : "Private invitation"}
                </span>
              </div>
              <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 dark:bg-white/5">
                  <dt className="text-slate-400">Group leader</dt>
                  <dd className="mt-1 font-bold text-[#17212B] dark:text-white">
                    {personName(preview.leader)}
                  </dd>
                </div>
                <div className="rounded-xl bg-white p-3 dark:bg-white/5">
                  <dt className="text-slate-400">Program</dt>
                  <dd className="mt-1 font-bold text-[#17212B] dark:text-white">
                    {preview.program?.code || preview.program?.name}
                  </dd>
                </div>
                <div className="rounded-xl bg-white p-3 dark:bg-white/5">
                  <dt className="text-slate-400">Researchers</dt>
                  <dd className="mt-1 font-bold text-[#17212B] dark:text-white">
                    {preview.memberCount}
                  </dd>
                </div>
                <div className="rounded-xl bg-white p-3 dark:bg-white/5">
                  <dt className="text-slate-400">Adviser</dt>
                  <dd className="mt-1 font-bold text-[#17212B] dark:text-white">
                    {personName(preview.adviser)}
                  </dd>
                </div>
              </dl>
            </div>
            {!success && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  Use another code
                </button>
                <button
                  type="button"
                  onClick={() => void joinGroup()}
                  disabled={joining}
                  className="rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {joining
                    ? "Submitting…"
                    : preview.accessMode === "PUBLIC_APPROVAL"
                      ? "Request to join"
                      : "Join group"}
                </button>
              </div>
            )}
          </div>
        )}

        {message && (
          <p
            className={`mt-4 rounded-xl border p-3 text-base font-semibold sm:text-base ${
              success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push("/student/dashboard?tab=group")}
          className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200 sm:text-sm"
        >
          Back to My Projects
        </button>
      </section>
    </div>
  );
}
