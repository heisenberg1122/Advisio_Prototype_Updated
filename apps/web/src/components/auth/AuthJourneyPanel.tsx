import { useState } from "react";
import {
  ClipboardCheck,
  FileText,
  GraduationCap,
  MessagesSquare,
  Pause,
  Play,
} from "lucide-react";

export function AuthJourneyPanel() {
  const [journeyPaused, setJourneyPaused] = useState(false);
  return (
    <section className="login-story" aria-labelledby="login-story-title">
      <img
        src="/school-logo.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="login-story-watermark"
      />
      <header className="login-story-header">
        <div className="login-brand">
          <div className="login-brand-mark">
            <img
              src="/advisio-symbol-transparent.webp"
              alt="Advisio"
              width={48}
              height={44}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="login-brand-name">
              advisio<span className="login-brand-dot">.</span>
            </div>
            <div className="login-brand-caption">Research, connected</div>
          </div>
        </div>

        <div className="login-university">
          <div>
            <p className="login-university-name">
              University of the Assumption
            </p>
            <p className="login-university-location">
              City of San Fernando, Pampanga
            </p>
          </div>
          <img
            src="/school-logo.png"
            alt="University of the Assumption"
            className="login-university-seal"
          />
        </div>
      </header>

      <div className="login-story-content">
        <div className="login-story-copy">
          <p className="login-eyebrow">University Research Management System</p>
          <h1 id="login-story-title" className="login-story-headline">
            <span>A clearer path</span>
            <span>
              through <span className="login-headline-accent">research.</span>
            </span>
          </h1>
          <p className="login-story-description">
            From proposal to final defense, Advisio keeps every stage connected.
          </p>
          <div
            className="login-journey"
            data-paused={journeyPaused || undefined}
            role="group"
            aria-label="The research journey"
          >
            <div className="login-journey-caption">
              <span>One connected journey</span>
              <div className="login-journey-controls">
                <span className="login-journey-index" aria-hidden="true">
                  01 — 04
                </span>
                <button
                  type="button"
                  className="login-journey-toggle"
                  onClick={() => setJourneyPaused((paused) => !paused)}
                  aria-label={
                    journeyPaused
                      ? "Resume research journey animation"
                      : "Pause research journey animation"
                  }
                  aria-pressed={journeyPaused}
                >
                  {journeyPaused ? (
                    <Play size={12} aria-hidden="true" />
                  ) : (
                    <Pause size={12} aria-hidden="true" />
                  )}
                  {journeyPaused ? "Play" : "Pause"}
                </button>
              </div>
            </div>
            <div className="login-journey-map">
              <svg
                className="login-journey-path"
                viewBox="0 0 560 280"
                preserveAspectRatio="none"
                fill="none"
                aria-hidden="true"
              >
                <path
                  className="login-path-track"
                  d="M48 204H142Q188 204 188 158V152Q188 106 234 106H282Q328 106 328 60Q328 40 362 40H512"
                />
                <path
                  className="login-path-progress"
                  pathLength="1"
                  d="M48 204H142Q188 204 188 158V152Q188 106 234 106H282Q328 106 328 60Q328 40 362 40H512"
                />
              </svg>
              <ol className="login-milestones">
                {[
                  { label: "Proposal", Icon: FileText },
                  { label: "Advising", Icon: MessagesSquare },
                  { label: "Review", Icon: ClipboardCheck },
                  { label: "Defense", Icon: GraduationCap },
                ].map(({ label, Icon }, index) => (
                  <li
                    key={label}
                    className={`login-milestone login-milestone-${index + 1}`}
                  >
                    <span className="login-milestone-node">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="login-milestone-label">
                      <span className="login-milestone-number">
                        0{index + 1}
                      </span>
                      {label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <p className="login-journey-note">
          Every conversation. Every revision. A step forward.
        </p>
      </div>
      <footer className="login-story-footer">
        <span>Built for the university research community</span>
        <span>ADVISIO · UA</span>
      </footer>
    </section>
  );
}

export function AuthMobileBrand() {
  return (
    <div className="login-mobile-brand">
      <div className="login-mobile-brand-group">
        <div className="login-mobile-mark">
          <img
            src="/advisio-symbol-transparent.webp"
            alt="Advisio"
            width={44}
            height={44}
            className="h-full w-full object-contain"
          />
        </div>
        <div>
          <p className="login-mobile-name">
            advisio<span className="login-brand-dot">.</span>
          </p>
          <p className="login-mobile-caption">Research, connected</p>
        </div>
      </div>
      <img
        src="/school-logo.png"
        alt="University of the Assumption"
        className="login-mobile-seal"
      />
    </div>
  );
}
