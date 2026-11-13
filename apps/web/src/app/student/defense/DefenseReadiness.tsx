import { Link } from "react-router-dom";
import type { DefenseEligibility, DefenseRequirement } from "@/types/student";

const STATUS_TEXT = { done: "Met", in_progress: "In progress", pending: "Not started" } as const;

/** One plain-language line under each requirement, chosen from its label. */
export function DefenseReadiness({
  eligibility,
  requirements,
  requirementsHref,
  sessionStatus,
}: {
  eligibility: DefenseEligibility;
  requirements: DefenseRequirement[];
  requirementsHref: string;
  sessionStatus?: string;
}) {
  const met = requirements.filter((requirement) => requirement.status === "done").length;
  const eligible = eligibility === "eligible";
  const left = requirements.length - met;
  const reschedule = sessionStatus === "NEEDS_RESCHEDULING";
  const awaitingPanel = sessionStatus === "PENDING_ACKNOWLEDGEMENT";
  const confirmed = Boolean(sessionStatus && !reschedule && !awaitingPanel);

  return (
    <>
      <section className="rdf-ready" data-eligible={eligible} aria-labelledby="rdf-ready-title">
        <div className="rdf-ready-head">
          <span className="rdf-ready-icon" aria-hidden="true">
            <i className={`ti ${eligible ? "ti-shield-check" : "ti-lock"}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rdf-ready-title">{confirmed ? "Defense schedule confirmed" : awaitingPanel ? "Waiting for panel replies" :
              reschedule ? "Waiting for the coordinator to reschedule" : eligible ? "Eligible for defense scheduling" : "Defense readiness"}</h2>
            <p>
              {confirmed ? "The panel and research group can see the confirmed schedule." :
                awaitingPanel ? "Required panel members need to reply before the schedule is confirmed." :
                reschedule ? "The professor or coordinator needs to propose another time." : eligible
                ? "Every requirement is met. Your professor or coordinator can now place your group in a defense event."
                : `Scheduling opens once the steps below are complete. ${left} ${left === 1 ? "step remains" : "steps remain"}.`}
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
              const hint = requirement.status === "done" ? undefined : requirement.hint;
              const needsWork = requirement.id === "requirements" && requirement.status !== "done";
            return (
              <li key={requirement.id} data-status={requirement.status}>
                <span className="rdf-req-num" aria-hidden="true">
                  {requirement.status === "done" ? <i className="ti ti-check" /> : index + 1}
                </span>
                <span className="rdf-req-text">
                  <span className="rdf-req-label">{requirement.label}</span>
                  {(hint || needsWork) && (
                    <span className="rdf-req-hint">
                      {hint}
                      {needsWork && (
                        <>
                          {hint ? " · " : ""}
                          <Link to={requirementsHref}>Open requirements <span aria-hidden="true">→</span></Link>
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
          <li data-current={!eligible && !sessionStatus}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-list-check" /></span>
            <span><strong>Requirements, eligibility and Dean approval</strong><small>{eligible || sessionStatus ? "Done" : "See the checklist above"}</small></span>
          </li>
          <li data-current={(eligible && !sessionStatus) || reschedule}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-calendar-plus" /></span>
            <span><strong>Coordinator proposes a schedule</strong><small>{reschedule ? "A new schedule is needed" : "Your group is placed in a defense event"}</small></span>
          </li>
          <li data-current={awaitingPanel}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-users" /></span>
            <span><strong>Required panel members reply</strong><small>{awaitingPanel ? "Waiting for replies" : "Panel members confirm their availability"}</small></span>
          </li>
          <li data-current={confirmed}>
            <span className="rdf-next-icon" aria-hidden="true"><i className="ti ti-presentation" /></span>
            <span><strong>Confirmed schedule</strong><small>See the date, panel and room in your Defense record</small></span>
          </li>
        </ol>
      </section>
    </>
  );
}
