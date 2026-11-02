import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  clearEvaluation,
  evaluationRequest,
  type EvaluationSession,
} from "./EvaluationPage";

export function EvaluationBanner() {
  const location = useLocation();
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const active = localStorage.getItem("advisio_token") === "__evaluation__";
  useEffect(() => {
    if (!active) return;
    let current = true;
    evaluationRequest<EvaluationSession>("session")
      .then((value) => {
        if (current) setSession(value);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [active]);
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open]);
  if (!active || !session || location.pathname.startsWith("/evaluate"))
    return null;
  async function end() {
    setBusy(true);
    try {
      await evaluationRequest("end", { method: "POST" });
      clearEvaluation();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <aside className="evaluation-banner" aria-label="Evaluation controls">
        <span>
          <strong>Evaluation environment</strong>
          <small>
            {session.roleLabel} · {session.courseLabel}
          </small>
        </span>
        <button onClick={() => setOpen(true)}>
          Activity guide &amp; questionnaire
        </button>
      </aside>
      {open && (
        <div className="evaluation-overlay">
          <section
            className="evaluation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluation-guide-title"
            tabIndex={-1}
            ref={(node) => node?.focus()}
          >
            <div className="evaluation-actions">
              <h2 id="evaluation-guide-title">Your evaluation activities</h2>
              <button
                className="secondary"
                onClick={() => setOpen(false)}
                aria-label="Close activity guide"
              >
                Close
              </button>
            </div>
            <p>
              <strong>
                {session.roleLabel} · {session.courseLabel}
              </strong>
            </p>
            <p>{session.title}</p>
            <ol>
              {session.tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ol>
            {session.role === "student" && (
              <p>
                <a
                  href="/api/evaluation/revision"
                  download={session.revisionName}
                >
                  Download the prepared revision PDF
                </a>
              </p>
            )}
            <p>
              Use this private workspace to complete the activities. If
              something fails or you need help, tell the facilitator; you may
              still answer the questionnaire honestly.
            </p>
            <h3>After your activities</h3>
            {session.surveyUrl ? (
              <>
                <p>
                  Confirm that the questionnaire shows{" "}
                  <strong>{session.roleLabel}</strong>
                  {session.role === "student"
                    ? ` and ${session.courseLabel} as your program`
                    : ""}
                  . Submit your response in Google Forms, then return here and
                  end your session.
                </p>
                <a
                  className="evaluation-link-button"
                  href={session.surveyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open TAM questionnaire
                </a>
              </>
            ) : (
              <p className="evaluation-help">
                The facilitator has not enabled the published questionnaire link
                yet. Ask for the questionnaire after your activities.
              </p>
            )}
            <p className="evaluation-help">
              Opening the questionnaire does not confirm that a response was
              submitted.
            </p>
            {error && (
              <p role="alert" className="evaluation-error">
                {error}
              </p>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmEnd(true)}
            >
              {busy ? "Closing…" : "End evaluation session"}
            </button>
            {confirmEnd && (
              <div role="alert">
                <p>End this session and clear its practice records?</p>
                <div className="evaluation-actions">
                  <button disabled={busy} onClick={end}>
                    End and clear workspace
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirmEnd(false)}
                  >
                    Keep working
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
