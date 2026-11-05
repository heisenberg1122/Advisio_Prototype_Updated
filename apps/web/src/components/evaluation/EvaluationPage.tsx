import React, { useEffect, useState } from "react";
import {
  clearEvaluation,
  evaluationRequest,
  type EvaluationConfig,
  type EvaluationSession,
} from "./evaluation-client";
import { evaluationLink, resolveInvitation } from "./evaluation-invitation";
import {
  EvaluationAbout,
  EvaluationBrand,
  EvaluationSteps,
  EvaluationSupport,
} from "./EvaluationShared";
import "./evaluation.css";

export default function EvaluationPage({ print = false }: { print?: boolean }) {
  const [config, setConfig] = useState<EvaluationConfig | null>(null);
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [role, setRole] = useState("");
  const [course, setCourse] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const value = await evaluationRequest<EvaluationConfig>("config");
        if (current) {
          setConfig(value);
          const invitation = resolveInvitation(location.search, value);
          setRole(invitation.role?.id || "");
          setCourse(invitation.course?.id || "");
        }
        if (!print) {
          const active = await evaluationRequest<EvaluationSession>(
            "session",
          ).catch(() => null);
          if (current) setSession(active);
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
  }, [print]);
  const invitation = config ? resolveInvitation(location.search, config) : null;
  const invitationBase = config?.invitationUrl || config?.entryUrl;
  const entryUrl = invitationBase
    ? evaluationLink(
        invitationBase,
        { role, course },
        new URL(invitationBase).pathname,
      )
    : "";
  const colleges = config?.colleges || config?.courses || [];
  const conflictingInvitation =
    session &&
    ((invitation?.role && invitation.role.id !== session.role) ||
      (invitation?.course && invitation.course.id !== session.course));
  async function begin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const started = await evaluationRequest<EvaluationSession>("session", {
        method: "POST",
        body: JSON.stringify({ role, course, acknowledged }),
      });
      localStorage.setItem("advisio_token", "__evaluation__");
      window.location.assign(started.home);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function end() {
    setBusy(true);
    try {
      await evaluationRequest("end", { method: "POST" });
      clearEvaluation(session?.progressKey || session?.projectId, {
        role: invitation?.role?.id,
        course: invitation?.course?.id,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="evaluation-page">
      <section className="evaluation-card">
        <EvaluationBrand />
        <h1>
          {print
            ? "Scan to begin your evaluation"
            : "Welcome to the ADVISIO evaluation"}
        </h1>
        <p>
          Explore ADVISIO using fictional research records prepared for your
          selected role and college. Your activities stay in your own temporary
          evaluation workspace.
        </p>
        {error && (
          <p className="evaluation-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p role="status">Connecting to the evaluation…</p>}
        {!print && (
          <section
            className="evaluation-overview"
            aria-labelledby="evaluation-how-title"
          >
            <h2 id="evaluation-how-title">How the evaluation works</h2>
            <EvaluationSteps current={1} />
          </section>
        )}
        {config && print && (
          <>
            <div className="evaluation-print-controls no-print">
              <h2>Organizer QR sheet</h2>
              <p>
                Select a role and college to prepare an invitation QR, or leave
                both blank for the general entry page.
              </p>
              <label htmlFor="qr-role">Role for this invitation</label>
              <select
                id="qr-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">All roles</option>
                {config.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label htmlFor="qr-course">College / School</label>
              <select
                id="qr-course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="">Select on entry page</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.college}
                  </option>
                ))}
              </select>
            </div>
            <div className="evaluation-print">
              {(role || course) && (
                <p className="evaluation-assignment">
                  <strong>
                    {config.roles.find((r) => r.id === role)?.label ||
                      "Select your assigned role"}
                  </strong>
                  <span>
                    {config.courses.find((c) => c.id === course)?.label ||
                      "Select your program on the entry page"}
                  </span>
                </p>
              )}
              <img
                src={`/api/evaluation/qr${new URL(entryUrl).search}`}
                alt={`QR code linking to ${entryUrl}`}
                width="320"
                height="320"
              />
              <p className="evaluation-invitation-url">
                <a href={entryUrl}>{entryUrl}</a>
              </p>
              {config.localOnly && (
                <p className="evaluation-error">
                  Local preview: this address works only on this computer. A
                  shared HTTPS address is needed for respondents’ phones.
                </p>
              )}
              <div className="evaluation-actions no-print">
                <button onClick={() => window.print()}>Print QR sheet</button>
                <a
                  href={`/api/evaluation/qr${new URL(entryUrl).search}`}
                  download={`ADVISIO_${role || "all"}_${course || "programs"}_QR.png`}
                >
                  Download QR
                </a>
                <a href={entryUrl}>Open invitation</a>
              </div>
            </div>
          </>
        )}
        {config && !print && session && (
          <div className="evaluation-resume">
            <h2>Continue your evaluation</h2>
            <p>
              <strong>{session.roleLabel}</strong> · {session.courseLabel}
            </p>
            {conflictingInvitation && (
              <p className="evaluation-error">
                This invitation differs from your open workspace. End the
                current session before beginning with the new invitation.
              </p>
            )}
            <div className="evaluation-actions">
              <button
                disabled={busy || Boolean(conflictingInvitation)}
                onClick={() => {
                  localStorage.setItem("advisio_token", "__evaluation__");
                  window.location.assign(session.home);
                }}
              >
                Continue evaluation
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmEnd(true)}
              >
                End session
              </button>
            </div>
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
          </div>
        )}
        {config && !print && !session && (
          <form onSubmit={begin}>
            {invitation?.invalid && (
              <p className="evaluation-error" role="alert">
                Some invitation details were not recognized. Select the missing
                information below, or email us for help.
              </p>
            )}
            {invitation?.role ? (
              <div className="evaluation-assigned-field">
                <span>Your assigned role</span>
                <strong>{invitation.role.label}</strong>
              </div>
            ) : (
              <>
                <label htmlFor="evaluation-role">
                  Your assigned respondent role
                </label>
                <select
                  id="evaluation-role"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select your assigned role</option>
                  {config.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {invitation?.course ? (
              <div className="evaluation-assigned-field">
                <span>College / School for this evaluation</span>
                <strong>{invitation.course.college}</strong>
                <small>Representative program: {invitation.course.label}</small>
              </div>
            ) : (
              <>
                <label htmlFor="evaluation-course">
                  College / School for this evaluation
                </label>
                <select
                  id="evaluation-course"
                  required
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select your college or school</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.college}
                    </option>
                  ))}
                </select>
              </>
            )}
            <p className="evaluation-help">
              {invitation?.role && invitation?.course
                ? "These details came from your invitation. If they look incorrect, email us before beginning."
                : "Select your role and college. You can switch roles within this college during your session."}
            </p>
            <label className="evaluation-check">
              <input
                type="checkbox"
                required
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={busy}
              />
              <span>
                I understand that the records and activities are fictional and
                are provided for system evaluation only.
              </span>
            </label>
            <button type="submit" disabled={busy || !acknowledged}>
              {busy ? "Preparing your private workspace…" : "Begin Evaluation"}
            </button>
            {busy && (
              <p role="status" className="evaluation-help">
                Preparing the records may take a moment. Keep this page open;
                you do not need to begin again.
              </p>
            )}
            <p className="evaluation-help">
              No registration or personal account is required. Begin Evaluation
              opens your dashboard directly. Use Evaluation activities on your
              dashboard to find the checklist, prepared revision, role switcher,
              and TAM questionnaire.
            </p>
          </form>
        )}
        {!print && (
          <>
            <EvaluationAbout temporary={config?.temporaryStorage} />
            <EvaluationSupport />
          </>
        )}
      </section>
    </main>
  );
}
