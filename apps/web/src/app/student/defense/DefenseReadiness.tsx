import { Link } from "react-router-dom";
import type { DefenseEligibility, DefenseRequirement } from "@/types/student";

const STATUS_TEXT = { done: "Met", in_progress: "In progress", pending: "Not started" } as const;

/** One plain-language line under each requirement, chosen from its label. */
function requirementHint(
  requirement: DefenseRequirement,
  progress?: { completed: number; total: number } | null,
) {
  const label = requirement.label.toLowerCase();
  if (requirement.status === "done") return "Done";
  if (label.includes("milestone") && progress?.total) return `${progress.completed} of ${progress.total} approved`;
  if (label.includes("adviser")) return "Your professor assigns a faculty adviser to your group";
  if (label.includes("manuscript") || label.includes("submission")) return "Your adviser approves the final manuscript in Tasks";
  if (label.includes("dean")) return "Requested after the final manuscript is approved";
  return null;
}

export function DefenseReadiness({
  eligibility,
  requirements,
  progress,
  timelineHref,
}: {
  eligibility: DefenseEligibility;
  requirements: DefenseRequirement[];
  progress?: { completed: number; total: number } | null;
  timelineHref: string;
}) {
  const met = requirements.filter((requirement) => requirement.status === "done").length;
  const eligible = eligibility === "eligible";
  const left = requirements.length - met;

  return (
    <>
      <section className="rdf-ready" data-eligible={eligible} aria-labelledby="rdf-ready-title">
        <div className="rdf-ready-head">
          <span className="rdf-ready-icon" aria-hidden="true">
            <i className={`ti ${eligible ? "ti-shield-check" : "ti-lock"}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rdf-ready-title">{eligible ? "Eligible for defense scheduling" : "Not yet eligible for defense"}</h2>
            <p>
              {eligible
                ? "Every requirement is met. Your professor or coordinator can now place your group in a defense event."
                : `Scheduling opens once all ${requirements.length} requirements below are met. ${left} ${left === 1 ? "is" : "are"} left.`}
            </p>
            {requirements.length > 0 && (
              <div
                className="rdf-ready-bar"
                role="progressbar"
                aria-label="Defense requirements met"
                aria-valuemin={0}
                aria-valuemax={requirements.length}
                aria-valuenow={met}
              >
                <span style={{ width: `${(met / requirements.length) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
        <ol className="rdf-reqs">
          {requirements.map((requirement, index) => {
            const hint = requirementHint(requirement, progress);
            const isMilestones = requirement.label.toLowerCase().includes("milestone");
            return (
              <li key={requirement.id} data-status={requirement.status}>
                <span className="rdf-req-num" aria-hidden="true">
                  {requirement.status === "done" ? <i className="ti ti-check" /> : index + 1}
                </span>
                <span className="rdf-req-text">
                  <span className="rdf-req-label">{requirement.label}</span>
                  {(hint || (isMilestones && requirement.status !== "done")) && (
                    <span className="rdf-req-hint">
                      {hint}
                      {isMilestones && requirement.status !== "done" && (
                        <>
                          {hint ? " · " : ""}
                          <Link to={timelineHref}>Open timeline <span aria-hidden="true">→</span></Link>
                        </>
                      )}
                    </span>
                  )}
                </span>
                <span className="rdf-req-state">{STATUS_TEXT[requirement.status]}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rdf-next" aria-labelledby="rdf-next-title">
        <h2 id="rdf-next-title">What happens next</h2>
        <ol>
          <li data-current={!eligible}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-list-check" /></span>
            <span><strong>Meet the requirements</strong><small>{eligible ? "Done" : "You are here"}</small></span>
          </li>
          <li data-current={eligible}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-calendar-plus" /></span>
            <span><strong>Professor schedules</strong><small>Your group is placed in a defense event</small></span>
          </li>
          <li>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-presentation" /></span>
            <span><strong>Session appears here</strong><small>Date, panel and room show up automatically</small></span>
          </li>
        </ol>
      </section>
    </>
  );
}
