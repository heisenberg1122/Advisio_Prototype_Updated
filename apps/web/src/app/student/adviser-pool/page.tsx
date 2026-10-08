"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdvisers } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { CardsPageSkeleton } from "@/components/ui/Skeleton";

type RequestMethod = "details" | "pdf";

export default function AdviserPoolPage() {
  const { data, isPending, isError, refetch } = useAdvisers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdviser, setSelectedAdviser] = useState<any | null>(null);
  const [requestMethod, setRequestMethod] = useState<RequestMethod>("details");
  const [contactName, setContactName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberNames, setMemberNames] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestPdf, setRequestPdf] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openRequest = (adviser: any) => {
    if (adviser.isFull || !adviser.isAcceptingAdvisees) {
      setMessage(adviser.isAcceptingAdvisees ? "This adviser has reached their group capacity." : "This adviser is not accepting new requests.");
      return;
    }
    const project = data?.project;
    setSelectedAdviser(adviser);
    setRequestMethod("details");
    setContactName(`${user?.firstName || ""} ${user?.lastName || ""}`.trim());
    setGroupName(project?.title || "");
    setMemberNames((project?.members || []).filter((member: any) => member.projectRole !== "ADVISER" && !member.leftAt).map((member: any) => `${member.user?.firstName || ""} ${member.user?.lastName || ""}`.trim()).filter(Boolean).join(", "));
    setRequestNote("");
    setRequestPdf(null);
    setMessage(null);
  };

  const closeRequest = () => {
    setSelectedAdviser(null);
    setRequestPdf(null);
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!data?.projectId || !selectedAdviser?.id) throw new Error("Register a research project before requesting an adviser.");
      if (requestMethod === "details" && (!contactName.trim() || !groupName.trim() || !memberNames.trim())) throw new Error("Contact name, group name, and group members are required.");
      if (requestMethod === "pdf" && !requestPdf) throw new Error("Select the completed adviser request form in PDF format.");

      let requestFormDocumentId: string | undefined;
      if (requestMethod === "pdf" && requestPdf) {
        const formData = new FormData();
        formData.append("file", requestPdf);
        formData.append("title", `Adviser Request Form - ${data.project?.title || groupName || "Research Group"}`);
        formData.append("documentType", "ADVISER_REQUEST_FORM");
        const token = localStorage.getItem("advisio_token");
        const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const response = await fetch(`${apiBase}/api/research/${data.projectId}/documents`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData });
        const upload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(upload.error || "Unable to upload the adviser request form.");
        requestFormDocumentId = upload.document?.id;
      }

      const structuredNote = requestMethod === "details"
        ? [`Contact name: ${contactName.trim()}`, `Group name: ${groupName.trim()}`, `Members: ${memberNames.trim()}`, requestNote.trim() ? `Message: ${requestNote.trim()}` : ""].filter(Boolean).join("\n")
        : requestNote.trim() || "Completed adviser request form attached as PDF.";

      return apiClient.post("/api/adviser-requests", { researchId: data.projectId, adviserId: selectedAdviser.id, note: structuredNote, requestFormDocumentId });
    },
    onSuccess: async () => {
      setMessage("Your adviser request was sent successfully.");
      closeRequest();
      await queryClient.invalidateQueries({ queryKey: ["student", "advisers"] });
    },
    onError: (error: any) => setMessage(error?.message || "Unable to send adviser request."),
  });

  if (isPending) return <CardsPageSkeleton cards={4} />;
  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-5 text-sm text-rose-700 dark:text-rose-300">
          Unable to load verified advisers.{" "}
          <button onClick={() => refetch()} className="ml-2 font-extrabold underline cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { assigned, available, project } = data;
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {!project && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <i className="ti ti-alert-circle text-base shrink-0 text-amber-600" />
          <span>Register a research project before sending an adviser request.</span>
        </div>
      )}

      {message && !selectedAdviser && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <i className="ti ti-info-circle text-base shrink-0 text-blue-600" />
          <span>{message}</span>
        </div>
      )}

      {assigned && (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Assigned adviser</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar initials={assigned.initials} colorVariant="info" size="lg" />
              <div>
                <p className="font-extrabold text-[#17212B] dark:text-white text-base">{assigned.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{assigned.college} · {assigned.email}</p>
              </div>
            </div>
            <Tag variant="success">Assigned</Tag>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#17212B] dark:text-white">Available verified advisers</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Active institutional accounts with the Adviser role, including the demo adviser.</p>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1">
            {available.length} verified
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {available.map((adviser: any) => (
            <article
              key={adviser.id}
              className={`rounded-2xl border bg-white dark:bg-[#101b2b] p-5 sm:p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)] transition flex flex-col justify-between ${
                adviser.isFull
                  ? "border-[#E2E8F0] dark:border-white/10 opacity-75"
                  : "border-[#E2E8F0] dark:border-white/10 hover:border-[#0B3A53] dark:hover:border-[#FFA400] hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <div>
                <div className="flex items-start gap-3.5">
                  <Avatar initials={adviser.initials} colorVariant={adviser.colorVariant ?? "info"} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-[#17212B] dark:text-white">{adviser.name}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                        <i className="ti ti-rosette-discount-check" /> Verified
                      </span>
                      {adviser.email === "adviser01@university.edu.ph" && (
                        <span className="rounded-full bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                          Demo adviser
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{adviser.college}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{adviser.email}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50/70 dark:bg-white/5 p-3.5 border border-[#EEF2F6] dark:border-white/5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {adviser.adviseeCount} of {adviser.maxAdviseeGroups} active groups
                    </span>
                    <span className="text-slate-400 dark:text-slate-400 font-medium">
                      {adviser.availableSlots} {adviser.availableSlots === 1 ? "slot" : "slots"} left
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        adviser.isFull ? "bg-rose-500" : "bg-[#0B3A53] dark:bg-[#FFA400]"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          adviser.maxAdviseeGroups ? (adviser.adviseeCount / adviser.maxAdviseeGroups) * 100 : 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end border-t border-[#EEF2F6] dark:border-white/10 pt-4">
                {!adviser.isAcceptingAdvisees ? (
                  <Tag variant="neutral">Requests paused</Tag>
                ) : adviser.isFull ? (
                  <Tag variant="warn">Capacity full</Tag>
                ) : adviser.requestStatus === "PENDING" ? (
                  <Tag variant="info">Request pending</Tag>
                ) : adviser.requestStatus === "ACCEPTED" ? (
                  <Tag variant="success">Accepted</Tag>
                ) : (
                  <button
                    onClick={() => openRequest(adviser)}
                    disabled={!project || Boolean(assigned)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#FFA400] hover:bg-[#E59400] text-[#072A3D] px-5 text-xs font-bold shadow-xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    Request adviser
                  </button>
                )}
              </div>
            </article>
          ))}
          {!available.length && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-[#DDE3E8] dark:border-white/10 bg-white/60 dark:bg-[#101b2b]/60 p-10 text-center flex flex-col items-center justify-center gap-2">
              <i className="ti ti-users text-4xl text-slate-300 dark:text-slate-600 mb-1" />
              <p className="font-extrabold text-[#17212B] dark:text-white">No advisers available</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">No verified advisers are currently available for requests.</p>
            </div>
          )}
        </div>
      </section>

      {selectedAdviser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adviser-request-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRequest();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-[#101b2b] p-6 sm:p-7 shadow-2xl border border-[#EEF2F6] dark:border-white/10">
            <div className="flex items-start justify-between border-b border-[#EEF2F6] dark:border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227]">Formal Request</p>
                <h2 id="adviser-request-title" className="text-xl font-extrabold text-[#17212B] dark:text-white">
                  Request {selectedAdviser.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Choose how you want to submit the formal request.
                </p>
              </div>
              <button
                onClick={closeRequest}
                aria-label="Close adviser request"
                className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
              >
                <i className="ti ti-x text-xl" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-white/5 p-1 border border-[#EEF2F6] dark:border-white/10">
              <button
                onClick={() => setRequestMethod("details")}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                  requestMethod === "details"
                    ? "bg-white dark:bg-[#101b2b] text-[#0B3A53] dark:text-[#C9A227] shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <i className="ti ti-forms mr-1" />
                Fill in details
              </button>
              <button
                onClick={() => setRequestMethod("pdf")}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
                  requestMethod === "pdf"
                    ? "bg-white dark:bg-[#101b2b] text-[#0B3A53] dark:text-[#C9A227] shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <i className="ti ti-file-type-pdf mr-1" />
                Upload PDF form
              </button>
            </div>

            {requestMethod === "details" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Representative name" value={contactName} onChange={setContactName} />
                <Field label="Group / research name" value={groupName} onChange={setGroupName} />
                <label className="sm:col-span-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Group members
                  <textarea
                    value={memberNames}
                    onChange={(e) => setMemberNames(e.target.value)}
                    rows={3}
                    placeholder="Separate names with commas"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] dark:focus:border-[#C9A227]"
                  />
                </label>
              </div>
            ) : (
              <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50/50 dark:bg-white/5 p-7 text-center transition hover:border-[#0B3A53] dark:hover:border-[#C9A227]">
                <i className="ti ti-file-upload text-3xl text-[#0B3A53] dark:text-[#C9A227]" />
                <span className="mt-2 text-sm font-extrabold text-[#17212B] dark:text-white">
                  {requestPdf?.name || "Select completed adviser request form"}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF only, maximum 10 MB</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024)) {
                      setMessage("The request form must be a PDF no larger than 10 MB.");
                      setRequestPdf(null);
                    } else {
                      setMessage(null);
                      setRequestPdf(file);
                    }
                  }}
                />
              </label>
            )}

            <label className="mt-4 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Message to adviser <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Explain why this adviser is a good match for your research."
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] dark:focus:border-[#C9A227]"
              />
            </label>

            {message && <p className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">{message}</p>}

            <div className="mt-6 flex justify-end gap-2.5 border-t border-[#EEF2F6] dark:border-white/10 pt-4">
              <button
                onClick={closeRequest}
                className="rounded-xl border border-slate-300 dark:border-white/15 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] text-white px-5 py-2.5 text-xs font-extrabold shadow-xs transition disabled:opacity-60 cursor-pointer"
              >
                {applyMutation.isPending ? "Submitting…" : "Submit adviser request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] dark:focus:border-[#C9A227]"
      />
    </label>
  );
}
