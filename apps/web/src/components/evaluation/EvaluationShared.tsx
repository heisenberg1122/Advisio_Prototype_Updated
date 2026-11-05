import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Mail } from "lucide-react";

export function EvaluationBrand() {
  return (
    <div className="evaluation-brand">
      <img
        className="evaluation-logo"
        src="/advisio-logo.png"
        alt="ADVISIO"
        width="480"
        height="384"
      />
      <span>Evaluation environment</span>
    </div>
  );
}

export function EvaluationSteps({
  current = 0,
  guideUrl,
}: {
  current?: number;
  guideUrl?: string;
}) {
  return (
    <ol className="evaluation-steps" aria-label="How the evaluation works">
      {[
        "Select demo experience",
        "Complete guided activities",
        "Return to Google Form",
      ].map((title, index) => (
        <li
          key={title}
          aria-current={current === index + 1 ? "step" : undefined}
        >
          <span>{index + 1}</span>
          {index === 0 && guideUrl ? (
            <Link to={guideUrl}>{title}</Link>
          ) : (
            <strong>{title}</strong>
          )}
        </li>
      ))}
    </ol>
  );
}

export function EvaluationAbout({
  temporary = false,
}: {
  temporary?: boolean;
}) {
  return (
    <details className="evaluation-about">
      <summary>About this evaluation</summary>
      <p>
        Your activities use fictional records in a temporary workspace.{" "}
        {temporary
          ? "If the session restarts, return to this page to begin again. "
          : ""}
        Answer and submit the TAM statements in your original Google Forms tab.
      </p>
      <a
        href="https://advisio-prototype-updated.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
      >
        Official ADVISIO website <ExternalLink size={13} aria-hidden="true" />
      </a>
      <p className="evaluation-help">
        Open Evaluation activities on your dashboard for the guided checklist.
        You can return to Google Forms even if an activity could not be
        completed.
      </p>
    </details>
  );
}

export function EvaluationSupport() {
  return (
    <div className="evaluation-support">
      <Mail size={18} aria-hidden="true" />
      <p>
        <strong>Need help?</strong>
        <br />
        <a href="mailto:advisio.main@gmail.com?subject=ADVISIO%20Evaluation%20Support">
          advisio.main@gmail.com
        </a>
      </p>
    </div>
  );
}
