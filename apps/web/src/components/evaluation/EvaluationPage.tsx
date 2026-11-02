import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./evaluation.css";

export type EvaluationSession = {
  role: string;
  roleLabel: string;
  course: string;
  courseLabel: string;
  college: string;
  title: string;
  home: string;
  projectId: string;
  defenseId: string | null;
  tasks: string[];
  revisionName: string;
  expiresAt: string;
  surveyUrl: string | null;
};
type Config = {
  roles: { id: string; label: string }[];
  courses: { id: string; label: string; college: string }[];
  entryUrl: string;
  localOnly: boolean;
};
export async function evaluationRequest<T>(
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`/api/evaluation/${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => {
    throw new Error(
      "The evaluation is temporarily unavailable. Reload the page or ask the facilitator for help.",
    );
  });
  if (!response.ok)
    throw new Error(data.error || "Unable to connect to the evaluation.");
  return data as T;
}
export function clearEvaluation() {
  localStorage.removeItem("advisio_token");
  for (const key of [
    "advisio_theme:active",
    "advisio_color-theme:active",
    "advisio_college-theme:active",
  ])
    localStorage.removeItem(key);
  window.location.assign("/evaluate");
}
export default function EvaluationPage({ print = false }: { print?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
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
        const value = await evaluationRequest<Config>("config");
        if (current) {
          setConfig(value);
          const hint = new URLSearchParams(location.search).get("course");
          if (value.courses.some((c) => c.id === hint)) setCourse(hint!);
        }
        const active = await evaluationRequest<EvaluationSession>(
          "session",
        ).catch(() => null);
        if (current) setSession(active);
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
  async function begin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const value = await evaluationRequest<EvaluationSession>("session", {
        method: "POST",
        body: JSON.stringify({ role, course, acknowledged }),
      });
      localStorage.setItem("advisio_token", "__evaluation__");
      window.location.assign(value.home);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
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
    <main className="evaluation-page">
      <section className="evaluation-card">
        <div className="evaluation-brand">
          ADVISIO <span>Evaluation environment</span>
        </div>
        <h1>
          {print
            ? "Scan to begin your evaluation"
            : "Welcome to the ADVISIO evaluation"}
        </h1>
        <p>
          Explore ADVISIO using fictional research records prepared for your
          role and program. Your actions will stay in your own temporary
          workspace.
        </p>
        {error && (
          <p className="evaluation-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p role="status">Connecting to the evaluation…</p>}
        {config && print && (
          <div className="evaluation-print">
            <img
              src="/api/evaluation/qr"
              alt={`QR code linking to ${config.entryUrl}`}
              width="320"
              height="320"
            />
            <p>
              <a href={config.entryUrl}>{config.entryUrl}</a>
            </p>
            {config.localOnly && (
              <p className="evaluation-error">
                Local preview: this address works only on this computer. Use the
                link here to test it. A shared HTTPS address is needed for
                respondents’ phones.
              </p>
            )}
            <div className="evaluation-actions no-print">
              <button onClick={() => window.print()}>Print QR sheet</button>
              <a href="/api/evaluation/qr" download="ADVISIO_Evaluation_QR.png">
                Download QR
              </a>
              <Link to="/evaluate">Entry page</Link>
            </div>
          </div>
        )}
        {config && !print && session && (
          <div className="evaluation-resume">
            <h2>Your workspace is ready</h2>
            <p>
              {session.roleLabel} · {session.courseLabel}
            </p>
            <p>{session.title}</p>
            <div className="evaluation-actions">
              <button
                disabled={busy}
                onClick={() => {
                  localStorage.setItem("advisio_token", "__evaluation__");
                  window.location.assign(session.home);
                }}
              >
                Resume activities
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmEnd(true)}
              >
                End session
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
            </div>
          </div>
        )}
        {config && !print && !session && (
          <form onSubmit={begin}>
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
              <option value="">Choose your role</option>
              {config.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <label htmlFor="evaluation-course">
              Your assigned program or college scenario
            </label>
            <select
              id="evaluation-course"
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              disabled={busy}
            >
              <option value="">Choose your assigned program</option>
              {config.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.college}
                </option>
              ))}
            </select>
            <p className="evaluation-help">
              Faculty and Deans: use the scenario assigned by the facilitator.
              Each choice opens only the permissions for that role.
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
                I have received the facilitator’s study information and
                understand that these are fictional records for the evaluation.
              </span>
            </label>
            <button type="submit" disabled={busy || !acknowledged}>
              {busy ? "Preparing your private workspace…" : "Begin evaluation"}
            </button>
            <p className="evaluation-help">
              No registration, password, or participant code is needed. Complete
              the guided activities, then answer your role’s TAM questionnaire.
            </p>
          </form>
        )}
        {config && !print && (
          <p className="evaluation-help no-print">
            <Link to="/evaluate/print">Facilitator QR sheet</Link>
          </p>
        )}
      </section>
    </main>
  );
}
