import { useState } from "react";
import { Link } from "react-router-dom";
import { CohortSetupGuide } from "@/app/professor/cohorts/page";

export function CohortCaseMonitoring({
  projects,
  cohortId,
  loading,
  error,
  onOpen,
  onRemove,
}: {
  projects: any[];
  cohortId: string | null;
  loading: boolean;
  error: unknown;
  onOpen: (project: any) => void;
  onRemove: (project: any) => void;
}) {
  const [search, setSearch] = useState("");
  const scoped = projects.filter(
    (project) => !cohortId || project.cohortId === cohortId,
  );
  const visible = scoped.filter((project) =>
    [
      project.title,
      project.program?.name,
      project.researchType?.name,
      project.adviser?.firstName,
      project.adviser?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Research Cases
          </h2>
          <p className="mt-2 text-base text-[var(--color-text-secondary)]">
            Monitor started research and existing legacy studies. Academic
            membership is managed in Research Cohorts.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold text-[var(--color-primary)]"
          to="/professor/cohorts"
        >
          Research Cohorts
        </Link>
      </div>
      {cohortId && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Showing cases linked to the selected cohort.{" "}
          <Link
            className="font-bold text-[var(--color-primary)]"
            to="/professor/dashboard?tab=monitoring"
          >
            Show all authorized cases
          </Link>
        </p>
      )}
      {loading ? (
        <p role="status">Loading research cases…</p>
      ) : error ? (
        <p role="alert">
          Research cases could not be loaded. Please try again.
        </p>
      ) : (
        <>
          {scoped.length > 0 && (
            <label className="block text-sm font-semibold">
              Search research cases
              <input
                className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base"
                placeholder="Search study, program, track or adviser"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          )}
          {visible.map((project) => (
            <article
              key={project.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center"
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpen(project)}
              >
                <strong className="block break-words text-base text-[var(--color-text-primary)]">
                  {project.title || "Research study"}
                </strong>
                {project.isTitleProvisional && (
                  <span className="mt-1 block text-sm font-semibold text-amber-700">
                    Research title pending
                  </span>
                )}
                <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                  {project.researchers.length} researcher
                  {project.researchers.length === 1 ? "" : "s"} ·{" "}
                  {project.currentStage?.name || "Check assigned process"} ·{" "}
                  {project.progress}% complete · {project.status}
                </span>
              </button>
              <button
                className="min-h-11 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700"
                onClick={() => onRemove(project)}
              >
                Remove case
              </button>
            </article>
          ))}
          {!scoped.length && (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">
                No research cases yet{cohortId ? " for this cohort" : ""}. Cases
                appear after team leaders start research. Existing cases keep
                their assigned process.
              </p>
              <CohortSetupGuide />
            </>
          )}
          {scoped.length > 0 && !visible.length && (
            <p className="text-sm">No research cases match this search.</p>
          )}
        </>
      )}
    </section>
  );
}
