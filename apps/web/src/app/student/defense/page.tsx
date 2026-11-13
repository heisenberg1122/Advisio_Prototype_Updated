"use client";

import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDefense } from "@/hooks/use-student";
import { DefenseSkeleton } from "@/components/defense/DefenseSkeleton";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useActiveProject } from "@/providers/active-project-provider";
import { ResearcherDefenseRecord, readable } from "./ResearcherDefenseRecord";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { DefenseReadiness } from "./DefenseReadiness";
import "./researcher-defense.css";
import "../student-screens.css";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import { studentTaskDetailsHref } from "@/lib/student-task-navigation";

const activeStatuses = new Set([
  "LIVE",
  "DELIBERATION",
  "SCHEDULED",
  "PENDING_ACKNOWLEDGEMENT",
  "NEEDS_RESCHEDULING",
]);
export default function DefensePage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useDefense();
  const { user } = useAuth();
  const seal = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const projectSelection = useActiveProject(data?.projects || []);
  const activeSession = data?.sessions.find((session: any) => activeStatuses.has(session.status));
  const preferredSession = activeSession || (data?.defenseMilestoneId ? null :
    data?.sessions.find((session: any) => session.status === "COMPLETED")) || null;
  const selectedSession = sessionId
    ? data?.sessions.find((session: any) => session.id === sessionId) || null
    : preferredSession;
  const { data: packetData } = useQuery({
    queryKey: ["student-defense-packet", selectedSession?.id],
    queryFn: () =>
      apiClient.get<{ packet: any }>(
        `/api/defense-sessions/${selectedSession.id}/review-packet`,
      ),
    enabled: Boolean(
      selectedSession?.id && selectedSession?.packet?.status === "PUBLISHED",
    ),
    retry: false,
  });
  const { data: packetHistoryData } = useQuery({
    queryKey: ["student-defense-packet-history", selectedSession?.id],
    queryFn: () =>
      apiClient.get<{ publications: any[] }>(
        `/api/defense-sessions/${selectedSession.id}/review-packet/history`,
      ),
    enabled: Boolean(selectedSession?.id && packetData?.packet),
    retry: false,
  });
  const packet = packetData?.packet || null;

  useEffect(() => {
    if (!sessionId && preferredSession?.id)
      navigate(
        projectSelection.projectHref(`/student/defense/${preferredSession.id}`),
        { replace: true },
      );
  }, [navigate, preferredSession?.id, projectSelection.projectHref, sessionId]);

  if (isPending) return <DefenseSkeleton />;
  if (isError || !data)
    return (
      <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        <RoleBand eyebrow="Research defense" title="Your defense" titleId="student-defense-title" guide="researcher-defense-empty" meta="We couldn't load your defense information." />
        <div className="stu-notice" data-tone="attention" role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>Defense information could not be loaded</strong>
            <span>{error instanceof Error ? error.message : "Please try again."}</span>
          </div>
          <button type="button" className="rh-secondary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  if (!data.project)
    return (
      <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        <RoleBand
          eyebrow="Research defense"
          title="Your defense"
          titleId="student-defense-title"
          guide="researcher-defense-empty"
          meta={
            projectSelection.invalidRequestedProjectId
              ? "That project is unavailable or you do not have access to it."
              : data.projects.length
                ? "Choose which project's defense to view."
                : "Track schedules, panel and results here once you have a project."
          }
        />
        {data.projects.length ? (
          <section className="rh-panel" aria-labelledby="student-defense-pick">
            <div className="rh-head"><h2 id="student-defense-pick">Select a research project</h2></div>
            <ul className="rh-rows">
              {data.projects.map((project: any) => (
                <li key={project.id}>
                  <div className="rh-row">
                    <span className="rh-icon" aria-hidden="true"><i className="ti ti-folder" /></span>
                    <div className="rh-text">
                      <h3>{project.groupName || project.title}</h3>
                      {project.groupName && project.title && <p>{project.title}</p>}
                    </div>
                    <button type="button" className="rh-secondary" aria-label={`Open defense for ${project.groupName || project.title}`} onClick={() => projectSelection.selectProject(project.id)}>Open</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="stu-two">
            <section className="rh-panel" aria-labelledby="student-defense-none">
              <div className="stu-notice" data-tone="info">
                <i className="ti ti-presentation" aria-hidden="true" />
                <div className="stu-notice-text">
                  <strong id="student-defense-none">No research project yet</strong>
                  <span>Create or join a project before tracking its defense.</span>
                </div>
              </div>
              <Link to="/student/dashboard?tab=group" className="rh-cta stu-wide-cta">Open My Projects <i className="ti ti-arrow-right" aria-hidden="true" /></Link>
            </section>
            <aside className="rh-panel" aria-labelledby="student-defense-before">
              <div className="rh-head"><h2 id="student-defense-before">Before a defense</h2></div>
              <ol className="stu-steps">
                <li><span><strong>Join or create a project</strong></span></li>
                <li><span><strong>Complete your milestones</strong></span></li>
                <li><span><strong>Your coordinator schedules it</strong></span></li>
              </ol>
            </aside>
          </div>
        )}
      </div>
    );
  if (sessionId && !selectedSession)
    return (
      <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        <RoleBand eyebrow="Research defense" title="Your defense" titleId="student-defense-title" guide="researcher-defense-empty" meta="We couldn't find that defense session." />
        <div className="stu-notice" data-tone="waiting" role="status">
          <i className="ti ti-calendar-off" aria-hidden="true" />
          <div className="stu-notice-text">
            <strong>Defense session not found</strong>
            <span>This session is not assigned to your active research project, or it is no longer available.</span>
          </div>
          <button type="button" className="rs-primary" onClick={() => navigate(projectSelection.projectHref("/student/defense"))}>Open my defense</button>
        </div>
      </div>
    );

  const event = selectedSession?.defenseEvent;

  return (
    <div className="researcher-defense">
      <header className="rdf-header">
        {seal && <img className="rdf-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <div className="rdf-identity">
          <p className="rdf-eyebrow">Research defense</p>
          <div className="rdf-title-row">
            <h1 data-guide={selectedSession ? undefined : "researcher-defense-info"}>{event?.code || "Defense readiness"}</h1>
            {selectedSession && (
              <span
                className="rdf-session-status"
                data-status={selectedSession.status}
              >
                {readable(selectedSession.status)}
              </span>
            )}
          </div>
          <p className="rdf-project-title">{data.project.title}</p>
          {!selectedSession && (
            <dl className="rdf-facts">
              <div><dt>Requirements</dt><dd>{data.requirements.filter((item: any) => item.status === "done").length} of {data.requirements.length} met</dd></div>
              {data.progress && data.progress.total > 0 && (
                <div><dt>Research progress</dt><dd>{data.progress.completed} of {data.progress.total} milestones</dd></div>
              )}
              {data.progress?.current && <div><dt>Now on</dt><dd>{data.progress.current}</dd></div>}
            </dl>
          )}
          {selectedSession && (
            <div className="rdf-identifiers">
              <span>
                <strong>Professor event:</strong>{" "}
                <span className="rdf-identifier">
                  {event?.code || "Legacy session"}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Copy group session ID ${selectedSession.id}`}
                onClick={() =>
                  navigator.clipboard.writeText(selectedSession.id)
                }
              >
                <strong>Group session ID:</strong>{" "}
                <span className="rdf-identifier">{selectedSession.id}</span>{" "}
                <i className="ti ti-copy" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {data.projects.length > 1 && (
          <div className="rdf-header-actions">
            <select
              aria-label="Research project"
              value={data.project.id}
              onChange={(event) =>
                projectSelection.selectProject(event.target.value)
              }
            >
              <option value="" disabled>
                Select project
              </option>
              {data.projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.groupName || project.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>
      {(!selectedSession || activeStatuses.has(selectedSession.status)) && (
        <div className="rdf-readiness">
          <DefenseReadiness
            eligibility={data.eligibility}
            requirements={selectedSession ? data.requirements.map((requirement) => ({ ...requirement, status: "done" })) : data.requirements}
            requirementsHref={data.defenseMilestoneId
              ? studentTaskDetailsHref(`milestone-${data.defenseMilestoneId}`, data.project.id)
              : projectSelection.projectHref("/student/tasks")}
            sessionStatus={selectedSession?.status}
          />
        </div>
      )}
      {selectedSession && !activeStatuses.has(selectedSession.status) && data.defenseMilestoneId && (
        <Link className="inline-block font-semibold underline" to={projectSelection.projectHref("/student/defense")}>
          View readiness for the next defense
        </Link>
      )}
      {selectedSession && data.progress && data.progress.total > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5" aria-label="Research completion">
          <h2 className="font-extrabold">Research completion: {data.progress.completed} of {data.progress.total} milestones</h2>
          <progress className="mt-3 w-full" value={data.progress.completed} max={data.progress.total} />
          <p className="mt-2 text-sm">{data.progress.completed === data.progress.total ? "All research milestones completed." : `Current milestone: ${data.progress.current || "Awaiting the next milestone"}`}</p>
        </section>
      )}
      <ResearcherDefenseRecord
        selectedSession={selectedSession}
        sessions={data.sessions}
        packet={packet}
        packetHistoryData={packetHistoryData}
        documents={data.documents}
        researcherId={user?.id}
        projectHref={projectSelection.projectHref}
      />
    </div>
  );
}
