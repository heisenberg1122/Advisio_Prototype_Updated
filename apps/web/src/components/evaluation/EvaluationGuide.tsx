import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  evaluationRequest,
  type EvaluationConfig,
  type EvaluationSession,
} from "./evaluation-client";
import { evaluationLink, resolveInvitation } from "./evaluation-invitation";
import { readProgress, saveProgress } from "./evaluation-progress";
import {
  EvaluationAbout,
  EvaluationBrand,
  EvaluationSteps,
  EvaluationSupport,
} from "./EvaluationShared";
import "./evaluation.css";

export default function EvaluationGuide() {
  const [config, setConfig] = useState<EvaluationConfig | null>(null);
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const settings = await evaluationRequest<EvaluationConfig>("config");
        const active = await evaluationRequest<EvaluationSession>(
          "session",
        ).catch(() => null);
        if (current) {
          setConfig(settings);
          setSession(active);
        }
      } catch (e) {
        if (current) setError((e as Error).message);
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
  }, []);
  const invitation = config ? resolveInvitation(location.search, config) : null;
  const selectedRole = config?.roles.find(
    (item) => item.id === (session?.role || invitation?.role?.id),
  );
  const selectedCourse = config?.courses.find(
    (item) => item.id === (session?.course || invitation?.course?.id),
  );
  const tasks = session?.tasks || selectedRole?.tasks || [];
  const entry = config
    ? evaluationLink(config.entryUrl, {
        role: selectedRole?.id,
        course: selectedCourse?.id,
      })
    : "/evaluate";
  function startActivities() {
    if (!session) return;
    const progress = readProgress(session.projectId, session.tasks.length);
    saveProgress(session.projectId, { ...progress, phase: "activities" });
    localStorage.setItem("advisio_token", "__evaluation__");
    window.location.assign(session.home);
  }
  return (
    <main className="evaluation-page">
      <section className="evaluation-card evaluation-guide-card">
        <EvaluationBrand />
        <p className="evaluation-eyebrow">Step 1 of 3</p>
        <h1>Get familiar with ADVISIO</h1>
        <p>
          Read this short guide, try the activities in your own workspace, then
          answer the questionnaire based on your experience.
        </p>
        <EvaluationSteps current={1} />
        {loading && <p role="status">Loading your guide…</p>}
        {error && (
          <p className="evaluation-error" role="alert">
            {error}
          </p>
        )}
        {selectedRole && (
          <div className="evaluation-assignment">
            <strong>{selectedRole.label}</strong>
            {selectedCourse && (
              <span>
                {selectedCourse.label} · {selectedCourse.college}
              </span>
            )}
          </div>
        )}
        <section
          className="evaluation-written-guide"
          aria-labelledby="guide-start"
        >
          <h2 id="guide-start">Before you explore</h2>
          <ul>
            <li>
              Read the study information and consent details provided with your
              invitation. Participation is voluntary; you may stop at any time.
            </li>
            <li>
              The names, projects, files, schedules, and records are fictional.
              Use the prepared materials rather than uploading personal or
              confidential information.
            </li>
            <li>
              Your workspace is separate from other respondents. You can try the
              features available to your assigned role.
            </li>
          </ul>
          <h2>Find your way around</h2>
          <p>
            Start with the dashboard, then open the assigned project or defense.
            Look for its manuscript, progress, feedback, and available actions.
            Use the <strong>Evaluation guide</strong> button at the bottom of
            the screen to reopen your task checklist at any time.
          </p>
          <h2>Your guided activities</h2>
          {tasks.length ? (
            <ol>
              {tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ol>
          ) : (
            <p>
              Select your assigned role on the entry page to see the activities
              prepared for you.
            </p>
          )}
          {session?.role === "student" && (
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
            If a feature is unclear or does not work, note what happened. You
            can describe the difficulty in the questionnaire; you do not have to
            give a positive rating.
          </p>
          <h2>After exploring</h2>
          <p>
            In the evaluation guide, select <strong>Finish exploration</strong>,
            then open the TAM questionnaire. Base your answers on using ADVISIO,
            rather than on this introduction. Submit the form in Google Forms,
            then return to end your practice session.
          </p>
          <p className="evaluation-help">
            The video walkthrough is coming soon. Reading this guide is enough
            to proceed.
          </p>
        </section>
        <div className="evaluation-actions">
          {session ? (
            <button onClick={startActivities}>Start guided activities</button>
          ) : (
            !loading && (
              <Link className="evaluation-link-button" to={entry}>
                Return to begin evaluation
              </Link>
            )
          )}
          {session && <Link to={entry}>Back to entry page</Link>}
        </div>
        <EvaluationAbout temporary={config?.temporaryStorage} />
        <EvaluationSupport />
      </section>
    </main>
  );
}
