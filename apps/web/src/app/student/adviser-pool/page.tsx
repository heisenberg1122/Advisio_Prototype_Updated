"use client";

import { useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkflowStartPanel } from "@/components/workflow/WorkflowStartPanel";
import { useAdvisers } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, panelRequestHeaders } from "@/lib/api-client";
import { EmptyNote, StatusDot } from "@/components/ui/advisio";
import { ProgressTrack } from "@/components/dashboards/RoleHomeParts";
import { FilterChips, RoleBand, SearchField, ViewSwitch, plural, useScreenView } from "@/components/dashboards/RoleScreenParts";
import "../student-screens.css";
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
  const [filter, setFilter] = useState<"all" | "open" | "full" | "paused">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useScreenView("advisio:student-adviser-pool-view");

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
      <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        <div className="stu-notice" data-tone="attention" role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <div className="stu-notice-text"><strong>Unable to load verified advisers</strong></div>
          <button type="button" className="rh-secondary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const { assigned, available, pendingRequest } = data;
  const availability = (adviser: any) => (!adviser.isAcceptingAdvisees ? "paused" : adviser.isFull ? "full" : "open");
  const countOf = (value: string) => available.filter((adviser: any) => availability(adviser) === value).length;
  const openCount = countOf("open");
  const pendingAdviser = available.find((adviser: any) => adviser.requestStatus === "PENDING");
  const term = search.trim().toLowerCase();
  const advisers = available.filter(
    (adviser: any) =>
      (filter === "all" || availability(adviser) === filter) &&
      `${adviser.name} ${(adviser.facultyProfile?.expertiseKeywords || []).join(" ")}`.toLowerCase().includes(term),
  );
  const groupLabel = project?.groupName || project?.title;
  const bandMeta = assigned
    ? "Your group has an adviser. You can still browse the faculty list."
    : pendingAdviser
      ? `Your request is waiting for ${pendingAdviser.name} to respond.`
      : pendingRequest
        ? "Your adviser request is waiting for a response."
        : project && !isLeader
          ? "Browse verified advisers. Only your group leader can send a request."
          : `${plural(openCount, "adviser has", "advisers have")} open slots${groupLabel ? ` for ${groupLabel}` : ""}`;

  const adviserAction = (adviser: any) => {
    if (!adviser.isAcceptingAdvisees) return <StatusDot tone="neutral">Requests paused</StatusDot>;
    if (adviser.isFull) return <StatusDot tone="attention">Capacity full</StatusDot>;
    if (adviser.requestStatus === "PENDING") return <StatusDot tone="waiting">Request pending</StatusDot>;
    if (adviser.requestStatus === "ACCEPTED") return <StatusDot tone="done">Accepted</StatusDot>;
    if (pendingRequest) return <StatusDot tone="neutral">Another request is pending</StatusDot>;
    if (!isLeader) return <StatusDot tone="neutral">Leader only</StatusDot>;
    if (assigned) return null;
    return (
      <button
        type="button"
        id={`request-adviser-${adviser.id}`}
        data-testid={`request-adviser-${adviser.id}`}
        className="rs-primary"
        disabled={!project}
        onClick={() => openRequest(adviser)}
      >
        Request adviser
      </button>
    );
  };
  const capacity = (adviser: any) => (
    <div className="stu-capacity">
      <p>
        <span><b>{adviser.adviseeCount} of {adviser.maxAdviseeGroups}</b> active groups</span>
        <span>{plural(adviser.availableSlots, "slot", "slots")} left</span>
      </p>
      <ProgressTrack value={adviser.maxAdviseeGroups ? (adviser.adviseeCount / adviser.maxAdviseeGroups) * 100 : 100} tone={adviser.isFull ? "attention" : "brand"} />
    </div>
  );
  const keywords = (adviser: any, limit: number) => {
    const list: string[] = Array.isArray(adviser.facultyProfile?.expertiseKeywords) ? adviser.facultyProfile.expertiseKeywords : [];
    return (
      <>
        {list.slice(0, limit).map((keyword) => <span key={keyword} className="stu-tag">{keyword}</span>)}
        {list.length > limit && <span className="stu-tag">+{list.length - limit} more</span>}
      </>
    );
  };
  const roleLine = (adviser: any) => [adviser.facultyProfile?.facultyDesignation, adviser.college].filter(Boolean).join(" · ");
  const verifiedMark = <i className="ti ti-rosette-discount-check stu-verified" role="img" aria-label="Verified adviser" />;

  return (
    <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <RoleBand
        eyebrow="Adviser selection"
        title={assigned ? "Your adviser" : "Find your adviser"}
        titleId="student-adviser-pool-title"
        meta={bandMeta}
        counts={[
          { label: "Advisers", value: available.length },
          { label: "Open", value: openCount },
          { label: "Your request", value: pendingRequest || pendingAdviser ? 1 : 0, tone: pendingRequest || pendingAdviser ? "waiting" : undefined },
        ]}
        countsLabel="Adviser summary"
      />
      {milestoneId && project && (
        <div className="stu-notice" data-tone="info">
          <i className="ti ti-user-check" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>Adviser milestone</strong>
            <span>Select an adviser for {project.groupName || project.title || "your workflow"}. Acceptance will complete the milestone automatically.</span>
          </div>
          <Link to={studentTaskDetailsHref(`milestone-${milestoneId}`, project.id)} className="rh-secondary">
            <i className="ti ti-arrow-left" aria-hidden="true" /> Back to milestone
          </Link>
        </div>
      )}
      {!isLeader && project && (
        <div className="stu-notice" data-tone="info">
          <i className="ti ti-eye" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>You're viewing as a member</strong>
            <span>Only your research group leader can submit or withdraw adviser requests.</span>
          </div>
        </div>
      )}
      {!project && (data.workflowId ? <WorkflowStartPanel workflowId={data.workflowId} label="Start adviser selection" locked={(() => {
        const stages = data.workflow?.stages || [];
        const adviserStage = stages.find((stage: any) => stage.id === milestoneId || (!milestoneId && stage.milestoneType === "ADVISER_SELECTION"));
        return !!adviserStage && adviserStage.sequence > stages[0]?.sequence;
      })()} /> : (
        <div className="stu-notice" data-tone="info">
          <i className="ti ti-route" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>Join your professor's workflow first</strong>
            <span>Adviser selection starts from a workflow in Tasks &amp; Requirements. No registered research title is required.</span>
          </div>
          <Link to="/student/tasks" className="rh-secondary">Open Tasks</Link>
        </div>
      ))}

      {message && !selectedAdviser && (
        <div className="stu-notice" data-tone="done" role="status">
          <i className="ti ti-circle-check" aria-hidden="true" />
          <div className="stu-notice-text"><strong>{message}</strong></div>
          {project && (
            <Link to={milestoneId ? studentTaskDetailsHref(`milestone-${milestoneId}`, project.id) : studentTasksHref(project.id)} className="rh-secondary">
              <i className="ti ti-arrow-left" aria-hidden="true" /> Return to Tasks
            </Link>
          )}
        </div>
      )}

      {assigned && (
        <section className="stu-assigned" aria-label="Assigned adviser">
          <span className="rs-avatar" data-tone="dark" aria-hidden="true">{assigned.initials}</span>
          <div className="stu-assigned-text">
            <span>Assigned adviser</span>
            <h2>{assigned.name}</h2>
            <p>{assigned.college} · {assigned.email}</p>
          </div>
          <button type="button" className="rh-secondary" aria-label={`View academic profile for ${assigned.name}`} onClick={() => setProfileModalAdviser(assigned)}>
            <i className="ti ti-id" aria-hidden="true" /> View profile
          </button>
        </section>
      )}

      {(pendingAdviser || pendingRequest) && !assigned && (
        <div className="stu-notice" data-tone="waiting">
          <i className="ti ti-clock" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>{pendingAdviser ? `Request sent to ${pendingAdviser.name}` : "Adviser request pending"}</strong>
            <span>Acceptance completes the adviser milestone automatically.</span>
          </div>
        </div>
      )}

      <div className="rs-tools">
        <FilterChips
          label="Filter advisers"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: available.length },
            { value: "open", label: "Open", count: openCount },
            { value: "full", label: "Full", count: countOf("full") },
            { value: "paused", label: "Paused", count: countOf("paused") },
          ]}
        />
        <div className="rs-tools-end">
          <SearchField value={search} onChange={setSearch} placeholder="Search name or expertise" />
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </div>

      {!advisers.length ? (
        <div className="rs-empty-card">
          <EmptyNote
            layout="row"
            icon={available.length ? "ti-search" : "ti-users"}
            title={available.length ? "No advisers match" : "No advisers available"}
            text={available.length ? "Try another filter or clear your search." : "No verified advisers are currently available for requests."}
          />
        </div>
      ) : view === "cards" ? (
        <div className="rs-tiles">
          {advisers.map((adviser: any) => (
            <article key={adviser.id} className="stu-adviser">
              <button type="button" className="stu-adviser-top" aria-label={`View academic profile for ${adviser.name}`} onClick={() => setProfileModalAdviser(adviser)}>
                <span className="rs-avatar" data-tone="dark" aria-hidden="true">{adviser.initials}</span>
                <span className="rs-text">
                  <strong>{adviser.name}{verifiedMark}</strong>
                  <small>{roleLine(adviser)}</small>
                  <small>{adviser.email}</small>
                </span>
              </button>
              {Boolean(adviser.facultyProfile?.expertiseKeywords?.length) && <div className="stu-tags">{keywords(adviser, 3)}</div>}
              {capacity(adviser)}
              <div className="stu-adviser-foot">
                <button type="button" id={`view-profile-${adviser.id}`} data-testid={`view-profile-${adviser.id}`} className="rh-secondary" onClick={() => setProfileModalAdviser(adviser)}>
                  View profile
                </button>
                {adviserAction(adviser)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rs-table" style={{ "--rs-cols": "minmax(0,1.6fr) minmax(0,1.3fr) 170px 230px" } as CSSProperties}>
          <div className="rs-row rs-row--head"><span>Adviser</span><span>Expertise</span><span>Capacity</span><span /></div>
          {advisers.map((adviser: any) => (
            <div key={adviser.id} className="rs-row rs-row--hover">
              <button type="button" className="rs-who" style={{ textAlign: "left" }} aria-label={`View academic profile for ${adviser.name}`} onClick={() => setProfileModalAdviser(adviser)}>
                <span className="rs-avatar" data-tone="dark" aria-hidden="true">{adviser.initials}</span>
                <span className="rs-text"><strong>{adviser.name}{verifiedMark}</strong><small>{roleLine(adviser)}</small></span>
              </button>
              <span className="stu-tags rs-wide">{keywords(adviser, 2)}</span>
              <span className="rs-hide-small">{capacity(adviser)}</span>
              <div className="rs-actions">
                <button type="button" id={`view-profile-${adviser.id}`} data-testid={`view-profile-${adviser.id}`} className="rs-icon-btn" aria-label={`View profile for ${adviser.name}`} onClick={() => setProfileModalAdviser(adviser)}>
                  <i className="ti ti-id" aria-hidden="true" />
                </button>
                {adviserAction(adviser)}
              </div>
            </div>
          ))}
        </div>
      )}

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
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--color-white)] dark:bg-[var(--color-surface)] p-6 sm:p-7 shadow-2xl border border-[var(--color-border)]">
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Formal Request
                </p>
                <h2
                  id="adviser-request-title"
                  className="text-xl font-semibold text-[var(--color-text-primary)]"
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

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-white/5 p-1 border border-[var(--color-border)]">
              <button
                onClick={() => setRequestMethod("details")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                  requestMethod === "details"
                    ? "bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <i className="ti ti-forms mr-1" />
                Fill in details
              </button>
              <button
                onClick={() => setRequestMethod("pdf")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer ${
                  requestMethod === "pdf"
                    ? "bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
                }`}
              >
                <i className="ti ti-file-type-pdf mr-1" />
                Upload PDF form
              </button>
            </div>

            {requestMethod === "details" ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                  Project details
                </p>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-slate-500">Project</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">
                      {project?.title || "Title not registered yet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Group</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">
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
              <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50/50 dark:bg-white/5 p-7 text-center transition hover:border-[var(--color-primary)]">
                <i className="ti ti-file-upload text-3xl text-[var(--color-primary)]" />
                <span className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
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
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 dark:border-white/20 bg-[var(--color-white)] dark:bg-[var(--color-surface)] p-3 text-base text-slate-800 dark:text-slate-100 outline-none focus:border-[var(--color-primary)]"
              />
            </label>

            {message && (
              <p className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-base font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {message}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5 border-t border-[var(--color-border)] pt-4">
              <button
                onClick={closeRequest}
                className="rounded-xl border border-slate-300 dark:border-white/15 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="submission-action rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--college-on-primary)] px-5 py-2.5 text-sm font-semibold shadow-xs transition disabled:opacity-60 cursor-pointer"
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
