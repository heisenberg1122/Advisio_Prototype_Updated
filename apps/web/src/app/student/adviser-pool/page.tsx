"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkflowStartPanel } from "@/components/workflow/WorkflowStartPanel";
import { useAdvisers } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, panelRequestHeaders } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { CardsPageSkeleton } from "@/components/ui/Skeleton";
import { AdviserProfileModal } from "@/components/profile/AdviserProfileModal";
import {
  studentTaskDetailsHref,
  studentTasksHref,
} from "@/lib/student-task-navigation";

type RequestMethod = "details" | "pdf";

export default function AdviserPoolPage() {
  const searchParams = useSearchParams();
  const milestoneId = searchParams.get("milestoneId");
  const projectIdParam = searchParams.get("projectId");
  const { data, isPending, isError, refetch } = useAdvisers(projectIdParam, searchParams.get("workflowId"));
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAdviser, setSelectedAdviser] = useState<any | null>(null);
  const [profileModalAdviser, setProfileModalAdviser] = useState<any | null>(
    null,
  );
  const [requestMethod, setRequestMethod] = useState<RequestMethod>("details");
  const [requestNote, setRequestNote] = useState("");
  const [requestPdf, setRequestPdf] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const project = data?.project;
  const activeResearchers = (project?.members || []).filter(
    (member: any) =>
      !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole),
  );
  const isLeader = activeResearchers.some(
    (member: any) =>
      member.projectRole === "LEADER" &&
      (member.userId === user?.id || member.user?.id === user?.id),
  );



  const openRequest = (adviser: any) => {
    if (adviser.isFull || !adviser.isAcceptingAdvisees) {
      setMessage(
        adviser.isAcceptingAdvisees
          ? "This adviser has reached their group capacity."
          : "This adviser is not accepting new requests.",
      );
      return;
    }
    setSelectedAdviser(adviser);
    setRequestMethod("details");
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
      if (!data?.projectId || !selectedAdviser?.id)
        throw new Error(
          "Start your workflow before requesting an adviser. No research title is required.",
        );
      if (requestMethod === "pdf" && !requestPdf)
        throw new Error(
          "Select the completed adviser request form in PDF format.",
        );

      let requestFormDocumentId: string | undefined;
      if (requestMethod === "pdf" && requestPdf) {
        const formData = new FormData();
        formData.append("file", requestPdf);
        formData.append(
          "title",
          `Adviser Request Form - ${data.project?.title || "Research Group"}`,
        );
        formData.append("documentType", "ADVISER_REQUEST_FORM");
        const token = localStorage.getItem("advisio_token");
        const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const response = await fetch(
          `${apiBase}/api/research/${data.projectId}/documents`,
          {
            method: "POST",
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...panelRequestHeaders() },
            body: formData,
          },
        );
        const upload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            upload.error || "Unable to upload the adviser request form.",
          );
        requestFormDocumentId = upload.document?.id;
      }

      const structuredNote =
        requestNote.trim() ||
        (requestMethod === "pdf"
          ? "Completed adviser request form attached as PDF."
          : undefined);

      return apiClient.post("/api/adviser-requests", {
        researchId: data.projectId,
        adviserId: selectedAdviser.id,
        workflowStageId: milestoneId || undefined,
        note: structuredNote,
        requestFormDocumentId,
      });
    },
    onSuccess: async () => {
      setMessage("Your adviser request was sent successfully.");
      closeRequest();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student", "advisers"] }),
        queryClient.invalidateQueries({
          queryKey: ["student", "workflow-tasks"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["student-manuscript-workflow"],
        }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (error: any) =>
      setMessage(error?.message || "Unable to send adviser request."),
  });

  if (isPending || !user)
    return <CardsPageSkeleton cards={4} />;
  if (isError || !data) {
    return (
      <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-5 text-sm text-rose-700 dark:text-rose-300">
          Unable to load verified advisers.{" "}
          <button
            onClick={() => refetch()}
            className="ml-2 font-extrabold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { assigned, available, pendingRequest } = data;
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {milestoneId && project && (
        <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <i className="ti ti-user-check mt-0.5 text-lg" aria-hidden="true" />
            <div>
              <strong className="block">Adviser Milestone</strong>
              <span>
                Select an adviser for {project.groupName || project.title || "your workflow"}.
                Acceptance will complete the milestone automatically.
              </span>
            </div>
          </div>
          <Link
            to={studentTaskDetailsHref(`milestone-${milestoneId}`, project.id)}
            className="shrink-0 rounded-xl border border-blue-300 px-3 py-2 text-sm font-bold hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/40 inline-flex items-center gap-1.5"
          >
            <i className="ti ti-arrow-left text-xs" />
            Back to milestone
          </Link>
        </div>
      )}
      {!isLeader && project && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          <i
            className="ti ti-info-circle text-base text-blue-600 dark:text-blue-400 shrink-0"
            aria-hidden="true"
          />
          <span>
            Viewing verified advisers in read-only mode. Only your research
            group leader can submit or withdraw adviser requests.
          </span>
        </div>
      )}
      {!project && (data.workflowId ? <WorkflowStartPanel workflowId={data.workflowId} label="Start adviser selection" locked={(() => {
        const stages = data.workflow?.stages || [];
        const adviserStage = stages.find((stage: any) => stage.id === milestoneId || (!milestoneId && stage.milestoneType === "ADVISER_SELECTION"));
        return !!adviserStage && adviserStage.sequence > stages[0]?.sequence;
      })()} /> : <div className="rounded-xl border border-[var(--color-border)] p-5 text-[var(--color-text-primary)]">Join your professor’s workflow in <Link to="/student/tasks" className="font-bold underline">Tasks &amp; Requirements</Link> to start adviser selection. No registered research title is required.</div>)}

      {message && !selectedAdviser && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-4 text-sm text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <i className="ti ti-circle-check text-lg text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{message}</span>
          </div>
          {project && (
            <Link
              to={
                milestoneId
                  ? studentTaskDetailsHref(
                      `milestone-${milestoneId}`,
                      project.id,
                    )
                  : studentTasksHref(project.id)
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2 text-xs font-bold shadow-xs transition"
            >
              <i className="ti ti-arrow-left text-xs" />
              Return to Tasks
            </Link>
          )}
        </div>
      )}

      {assigned && (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 shadow-xs">
          <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Assigned adviser
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setProfileModalAdviser(assigned)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setProfileModalAdviser(assigned);
                }
              }}
              className="flex items-center gap-3.5 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl p-1 -m-1 transition"
              aria-label={`View academic profile for ${assigned.name}`}
            >
              <Avatar
                initials={assigned.initials}
                colorVariant="info"
                size="lg"
              />
              <div>
                <p className="font-extrabold text-[#17212B] dark:text-white text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition flex items-center gap-1.5">
                  {assigned.name}
                  <span className="text-xs font-normal text-slate-400 opacity-0 group-hover:opacity-100 transition">
                    (View CV)
                  </span>
                </p>
                <p className="text-base text-slate-500 dark:text-slate-400">
                  {assigned.college} · {assigned.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProfileModalAdviser(assigned)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition cursor-pointer"
              >
                <i className="ti ti-id" /> View Profile
              </button>
              <Tag variant="success">Assigned</Tag>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#17212B] dark:text-white">
              Available verified advisers
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Active institutional accounts with the Adviser role, including the
              demo adviser.
            </p>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setProfileModalAdviser(adviser)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setProfileModalAdviser(adviser);
                    }
                  }}
                  className="flex items-start gap-3.5 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#0B3A53] dark:focus:ring-[#FFA400] rounded-xl p-1 -m-1 transition"
                  aria-label={`View academic profile for ${adviser.name}`}
                >
                  <Avatar
                    initials={adviser.initials}
                    colorVariant={adviser.colorVariant ?? "info"}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-[#17212B] dark:text-white group-hover:text-[#0B3A53] dark:group-hover:text-[#FFA400] transition">
                        {adviser.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                        <i className="ti ti-rosette-discount-check" /> Verified
                      </span>
                    </div>
                    {adviser.facultyProfile?.facultyDesignation ? (
                      <p className="mt-0.5 text-base font-semibold text-[#C9A227]">
                        {adviser.facultyProfile.facultyDesignation}
                      </p>
                    ) : null}
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                      {adviser.college}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-400 dark:text-slate-500">
                      {adviser.email}
                    </p>
                  </div>
                </div>

                {/* Direct expertise keywords preview */}
                {Array.isArray(adviser.facultyProfile?.expertiseKeywords) &&
                  adviser.facultyProfile.expertiseKeywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {adviser.facultyProfile.expertiseKeywords
                        .slice(0, 3)
                        .map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10"
                          >
                            {keyword}
                          </span>
                        ))}
                      {adviser.facultyProfile.expertiseKeywords.length > 3 && (
                        <span className="text-xs font-medium text-slate-400 self-center">
                          +{adviser.facultyProfile.expertiseKeywords.length - 3}{" "}
                          more
                        </span>
                      )}
                    </div>
                  )}

                <div className="mt-5 rounded-xl bg-slate-50/70 dark:bg-white/5 p-3.5 border border-[#EEF2F6] dark:border-white/5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {adviser.adviseeCount} of {adviser.maxAdviseeGroups}{" "}
                      active groups
                    </span>
                    <span className="text-slate-400 dark:text-slate-400 font-medium">
                      {adviser.availableSlots}{" "}
                      {adviser.availableSlots === 1 ? "slot" : "slots"} left
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        adviser.isFull
                          ? "bg-rose-500"
                          : "bg-[#0B3A53] dark:bg-[#FFA400]"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          adviser.maxAdviseeGroups
                            ? (adviser.adviseeCount /
                                adviser.maxAdviseeGroups) *
                                100
                            : 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#EEF2F6] dark:border-white/10 pt-4">
                <button
                  type="button"
                  id={`view-profile-${adviser.id}`}
                  data-testid={`view-profile-${adviser.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileModalAdviser(adviser);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0B3A53] dark:text-[#C9A227] hover:underline cursor-pointer focus:outline-none"
                >
                  <i className="ti ti-id" /> View Profile
                </button>

                {!adviser.isAcceptingAdvisees ? (
                  <Tag variant="neutral">Requests paused</Tag>
                ) : adviser.isFull ? (
                  <Tag variant="warn">Capacity full</Tag>
                ) : adviser.requestStatus === "PENDING" ? (
                  <Tag variant="info">Request pending</Tag>
                ) : adviser.requestStatus === "ACCEPTED" ? (
                  <Tag variant="success">Accepted</Tag>
                ) : pendingRequest ? (
                  <Tag variant="neutral">Another request is pending</Tag>
                ) : !isLeader ? (
                  <Tag variant="neutral">Leader only</Tag>
                ) : (
                  <button
                    id={`request-adviser-${adviser.id}`}
                    data-testid={`request-adviser-${adviser.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRequest(adviser);
                    }}
                    disabled={!project || Boolean(assigned)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 text-sm font-bold shadow-xs transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
              <p className="font-extrabold text-[#17212B] dark:text-white">
                No advisers available
              </p>
              <p className="text-base text-slate-500 dark:text-slate-400">
                No verified advisers are currently available for requests.
              </p>
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
                <p className="text-sm font-extrabold uppercase tracking-widest text-[#C9A227]">
                  Formal Request
                </p>
                <h2
                  id="adviser-request-title"
                  className="text-xl font-extrabold text-[#17212B] dark:text-white"
                >
                  Request {selectedAdviser.name}
                </h2>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
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
                className={`rounded-lg px-3 py-2 text-sm font-extrabold transition cursor-pointer ${
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
                className={`rounded-lg px-3 py-2 text-sm font-extrabold transition cursor-pointer ${
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
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-extrabold uppercase tracking-widest text-slate-400">
                  Project details
                </p>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-slate-500">Project</dt>
                    <dd className="mt-1 font-extrabold text-[#17212B] dark:text-white">
                      {project?.title || "Title not registered yet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Group</dt>
                    <dd className="mt-1 font-extrabold text-[#17212B] dark:text-white">
                      {project?.groupName ||
                        (project?.participationMode === "SOLO"
                          ? "Individual researcher"
                          : "Research group")}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-bold text-slate-500">Researchers</dt>
                    <dd className="mt-1 text-slate-700 dark:text-slate-300">
                      {activeResearchers
                        .map((member: any) =>
                          `${member.user?.firstName || ""} ${member.user?.lastName || ""}`.trim(),
                        )
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-base text-slate-500">
                  These verified project details are included automatically and
                  cannot be changed in the request.
                </p>
              </div>
            ) : (
              <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50/50 dark:bg-white/5 p-7 text-center transition hover:border-[#0B3A53] dark:hover:border-[#C9A227]">
                <i className="ti ti-file-upload text-3xl text-[#0B3A53] dark:text-[#C9A227]" />
                <span className="mt-2 text-sm font-extrabold text-[#17212B] dark:text-white">
                  {requestPdf?.name || "Select completed adviser request form"}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  PDF only, maximum 10 MB
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (
                      file &&
                      (file.type !== "application/pdf" ||
                        file.size > 10 * 1024 * 1024)
                    ) {
                      setMessage(
                        "The request form must be a PDF no larger than 10 MB.",
                      );
                      setRequestPdf(null);
                    } else {
                      setMessage(null);
                      setRequestPdf(file);
                    }
                  }}
                />
              </label>
            )}

            <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-300">
              Message to adviser{" "}
              <span className="font-normal text-slate-400 dark:text-slate-500">
                (optional)
              </span>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Explain why this adviser is a good match for your research."
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] p-3 text-base text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] dark:focus:border-[#C9A227]"
              />
            </label>

            {message && (
              <p className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-base font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {message}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5 border-t border-[#EEF2F6] dark:border-white/10 pt-4">
              <button
                onClick={closeRequest}
                className="rounded-xl border border-slate-300 dark:border-white/15 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="submission-action rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] text-white px-5 py-2.5 text-sm font-extrabold shadow-xs transition disabled:opacity-60 cursor-pointer"
              >
                {applyMutation.isPending
                  ? "Submitting…"
                  : "Submit adviser request"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdviserProfileModal
        adviser={profileModalAdviser}
        isOpen={Boolean(profileModalAdviser)}
        onClose={() => setProfileModalAdviser(null)}
        onRequestAdviser={(adv) => {
          setProfileModalAdviser(null);
          openRequest(adv);
        }}
        canRequest={
          isLeader &&
          Boolean(project) &&
          !assigned &&
          !pendingRequest &&
          !profileModalAdviser?.isFull &&
          Boolean(profileModalAdviser?.isAcceptingAdvisees) &&
          profileModalAdviser?.requestStatus !== "PENDING" &&
          profileModalAdviser?.requestStatus !== "ACCEPTED"
        }
      />
    </div>
  );
}
