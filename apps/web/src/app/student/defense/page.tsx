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
import { ResearcherDefenseRecord, readable } from "./ResearcherDefenseRecord";
import "./researcher-defense.css";

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
  const projectSelection = useActiveProject(data?.projects || []);
  const preferredSession =
    data?.sessions.find((session: any) => activeStatuses.has(session.status)) ||
    data?.sessions[0] ||
    null;
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
      <div className="researcher-defense rdf-fallback">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <h1 className="font-extrabold">
            Defense information could not be loaded.
          </h1>
          <p className="mt-1">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 font-extrabold underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!data.project)
    return (
      <div className="researcher-defense rdf-fallback">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <i className="ti ti-presentation-off text-4xl text-slate-300" />
          <h1 className="mt-3 text-2xl font-extrabold text-[var(--color-text-primary)]">
            {data.projects.length
              ? "Select a research project"
              : "No research project yet"}
          </h1>
          <p className="mt-2 text-base text-slate-500">
            {projectSelection.invalidRequestedProjectId
              ? "That project is unavailable or you do not have access to it."
              : data.projects.length
                ? "Choose which project's defense information to view."
                : "Create or join a research project before tracking its defense."}
          </p>
          {data.projects.length ? (
            <select
              aria-label="Research project"
              value=""
              onChange={(event) =>
                projectSelection.selectProject(event.target.value || null)
              }
              className="mx-auto mt-5 block h-11 w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-base font-semibold"
            >
              <option value="">Choose a research project</option>
              {data.projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.groupName || project.title}
                </option>
              ))}
            </select>
          ) : (
            <Link
              to="/student/dashboard?tab=group"
              className="mt-5 inline-flex rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white"
            >
              Open My Projects
            </Link>
          )}
        </div>
      </div>
    );
  if (sessionId && !selectedSession)
    return (
      <div className="researcher-defense rdf-fallback">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <h1 className="font-extrabold">Defense session not found</h1>
          <p className="mt-1">
            This session is not assigned to your active research project, or it
            is no longer available.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(projectSelection.projectHref("/student/defense"))
            }
            className="mt-4 rounded-xl bg-[#173f63] px-4 py-2 text-sm font-extrabold text-white"
          >
            Open my defense
          </button>
        </div>
      </div>
    );

  const event = selectedSession?.defenseEvent;

  return (
    <div className="researcher-defense">
      <header className="college-hero-surface rdf-header">
        <div className="rdf-identity">
          <p className="rdf-eyebrow">Research defense</p>
          <div className="rdf-title-row">
            <h1>{event?.code || "Defense readiness"}</h1>
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
        <div className="rdf-header-actions">
          {data.projects.length > 1 && (
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
          )}
          <Link
            to={projectSelection.projectHref("/student/dashboard?tab=group")}
            className="rdf-action"
          >
            Back to My Projects
          </Link>
        </div>
      </header>
      {!selectedSession && (
        <div className="rdf-readiness">
          <h2 className="sr-only">Defense requirements</h2>
          <EligibilityBanner eligibility={data.eligibility} />
          <DefenseChecklist requirements={data.requirements} />
          <EmptyState
            size="md"
            icon="ti-calendar-time"
            title="No defense session has been created"
            description="Once every requirement is complete, the professor or coordinator can place your project into a defense event. The exact session will appear here automatically."
          />
        </div>
      )}
      <ResearcherDefenseRecord
        selectedSession={selectedSession}
        sessions={data.sessions}
        packet={packet}
        packetHistoryData={packetHistoryData}
        documents={data.documents}
        projectHref={projectSelection.projectHref}
      />
    </div>
  );
}
