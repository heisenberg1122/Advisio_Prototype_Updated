import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  clearEvaluation,
  evaluationRequest,
  type EvaluationSession,
} from "./evaluation-client";
import {
  readProgress,
  saveProgress,
  type EvaluationProgress,
} from "./evaluation-progress";
import { EvaluationSteps, EvaluationSupport } from "./EvaluationShared";

export function EvaluationBanner() {
  const location = useLocation();
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [progress, setProgress] = useState<EvaluationProgress>({
    phase: "activities",
    checked: [],
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = localStorage.getItem("advisio_token") === "__evaluation__";
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("advisio:evaluation-activities", show);
    return () =>
      window.removeEventListener("advisio:evaluation-activities", show);
  }, []);
  useEffect(() => {
    if (!active) return;
    let current = true;
    evaluationRequest<EvaluationSession>("session")
      .then((value) => {
        if (current) {
          setSession(value);
          setProgress(
            readProgress(
              value.progressKey || value.projectId,
              value.tasks.length,
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [active]);
  useEffect(() => {
    setOpen(false);
    setConfirmEnd(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key !== "Tab") return;
      const items = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],input:not([disabled])",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", listener);
    };
  }, [open, progress.phase]);
  if (!active || !session || location.pathname.startsWith("/evaluate"))
    return null;
  const questionnaire = progress.phase === "questionnaire";
  function update(next: EvaluationProgress) {
    setProgress(next);
    saveProgress(session!.progressKey || session!.projectId, next);
  }
  function toggle(index: number) {
    update({
      ...progress,
      checked: progress.checked.includes(index)
        ? progress.checked.filter((n) => n !== index)
        : [...progress.checked, index],
    });
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  async function end() {
    setBusy(true);
    try {
      await evaluationRequest("end", { method: "POST" });
      clearEvaluation(session?.progressKey || session?.projectId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function switchRole(role: string) {
    if (!session || role === session.role || busy) return;
    setBusy(true);
    setError("");
    try {
      const switched = await evaluationRequest<EvaluationSession>(
        "switch-role",
        {
          method: "POST",
          body: JSON.stringify({ role }),
        },
      );
      // Reload clears cached queries and renders the actual portal for the new identity.
      window.location.assign(switched.home);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <aside className="evaluation-banner" aria-label="Evaluation controls">
        <span>
          <strong>Step {questionnaire ? 3 : 2} of 3</strong>
          <small>
            {session.roleLabel} · {session.collegeCode || session.college}
          </small>
        </span>
        {!!session.roles?.length && (
          <label className="evaluation-role-switcher">
            <span>Demo role</span>
            <select
              aria-label="Switch demo role"
              value={session.role}
              disabled={busy}
              onChange={(e) => void switchRole(e.target.value)}
            >
              {session.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          ref={trigger}
          onClick={() => {
            setProgress(
              readProgress(
                session.progressKey || session.projectId,
                session.tasks.length,
              ),
            );
            setOpen(true);
          }}
        >
          Evaluation activities
        </button>
      </aside>
      {error && !open && (
        <p className="evaluation-switch-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <div className="evaluation-overlay">
          <section
            className="evaluation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluation-guide-title"
            tabIndex={-1}
            ref={dialog}
          >
            <div className="evaluation-actions">
              <h2 id="evaluation-guide-title">
                {questionnaire
                  ? "Ready for the questionnaire"
                  : "Explore ADVISIO"}
              </h2>
              <button
                className="secondary"
                onClick={close}
                aria-label="Close evaluation guide"
              >
                Close
              </button>
            </div>
            <EvaluationSteps current={questionnaire ? 3 : 2} />
            <p>
              <strong>
                {session.roleLabel} · {session.college}
              </strong>
              <br />
              {session.title}
            </p>
            {!questionnaire ? (
              <>
                <p>
                  Tick each activity as you try it. If you cannot complete one,
                  you can still describe what happened in the questionnaire.
                </p>
                <p className="evaluation-help">
                  {progress.checked.length} of {session.tasks.length} activities
                  ticked
                </p>
                <ol className="evaluation-task-list">
                  {session.tasks.map((task, index) => (
                    <li key={task}>
                      <label>
                        <input
                          type="checkbox"
                          checked={progress.checked.includes(index)}
                          onChange={() => toggle(index)}
                        />
                        <span>{task}</span>
                      </label>
                    </li>
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
                  Try the available features before answering. You may explore
                  beyond these activities and report any difficulties honestly.
                </p>
                <button
                  onClick={() =>
                    update({ ...progress, phase: "questionnaire" })
                  }
                >
                  Answer questionnaire
                </button>
              </>
            ) : (
              <>
                <p>
                  Answer the TAM questionnaire based on{" "}
                  <strong>your own experience using ADVISIO</strong> during this
                  evaluation. Check the respondent group and, where applicable,
                  program before answering.
                </p>
                {session.surveyUrl ? (
                  <a
                    className="evaluation-link-button"
                    href={session.surveyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Answer TAM questionnaire
                  </a>
                ) : (
                  <p className="evaluation-error">
                    The questionnaire is temporarily unavailable. Email us for
                    the correct link.
                  </p>
                )}
                <p className="evaluation-help">
                  Submit your response in Google Forms, then return here and end
                  your practice session. Opening the form does not submit a
                  response.
                </p>
                <button
                  className="secondary"
                  onClick={() => update({ ...progress, phase: "activities" })}
                >
                  Return to activity checklist
                </button>
              </>
            )}
            <EvaluationSupport />
            {error && (
              <p role="alert" className="evaluation-error">
                {error}
              </p>
            )}
            <button
              className="secondary evaluation-end"
              disabled={busy}
              onClick={() => setConfirmEnd(true)}
            >
              {busy ? "Closing…" : "End evaluation session"}
            </button>
            {confirmEnd && (
              <div role="alert">
                <p>
                  End this session and clear its practice records? Submitted
                  questionnaire responses are saved separately.
                </p>
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
