import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  FileText,
  Fingerprint,
  MessageSquare,
} from "lucide-react";
export function SecurityTrustSection() {
  return (
    <section id="security" className="lp-trust lp-section" data-scene>
      <div className="lp-container">
        <div className="lp-trust-heading">
          <p className="lp-eyebrow">04 / A record you can follow</p>
          <h2>
            Built for research
            <br />
            that needs to be traceable.
          </h2>
          <p>
            From the first revision to institutional approval, keep the process
            clear, connected, and accountable.
          </p>
        </div>
        <div className="lp-trust-grid">
          <article className="lp-trust-object">
            <div className="lp-object-label">
              <FileText size={17} />
              <span>Document history</span>
            </div>
            <div className="lp-version-title">Chapter 3 / Methodology</div>
            <div className="lp-versions">
              <div>
                <strong>v1.3</strong>
                <span>Current version</span>
                <i />
              </div>
              <div>
                <strong>v1.2</strong>
                <span>Adviser review</span>
              </div>
              <div>
                <strong>v1.1</strong>
                <span>Submitted</span>
              </div>
            </div>
            <h3>Every revision has context.</h3>
          </article>
          <article className="lp-trust-object">
            <div className="lp-object-label">
              <MessageSquare size={17} />
              <span>Adviser feedback</span>
            </div>
            <div className="lp-annotation">
              <span>Section 3.2 · Sampling procedure</span>
              <p>“Clarify the sampling criteria.”</p>
              <span className="lp-revision-tag">Needs revision</span>
            </div>
            <h3>Feedback stays with the work.</h3>
          </article>
          <article className="lp-trust-object">
            <div className="lp-object-label">
              <Check size={17} />
              <span>Workflow & approval</span>
            </div>
            <div className="lp-approval">
              <span>
                <Check size={14} />
                Submitted
              </span>
              <span>
                <Check size={14} />
                Reviewed
              </span>
              <span>
                <Check size={14} />
                Approved
              </span>
            </div>
            <div className="lp-record-caption">
              A visible path from submission to decision.
            </div>
            <h3>Milestones stay in view.</h3>
          </article>
          <article className="lp-trust-object">
            <div className="lp-object-label">
              <Fingerprint size={17} />
              <span>Institutional capability</span>
            </div>
            <ul className="lp-access-list">
              <li>
                <Check size={13} />
                Role-based access
              </li>
              <li>
                <Check size={13} />
                Activity history
              </li>
              <li>
                <Check size={13} />
                Configurable workflows
              </li>
              <li>
                <Check size={13} />
                Connected research records
              </li>
            </ul>
            <h3>Accountability, built in.</h3>
          </article>
        </div>
        <div className="lp-integration-note">
          <p>
            <strong>Works with your research tools.</strong> Google Drive
            storage, Calendar scheduling, and Meet links when configured. Google
            sign-in is a separate connection.
          </p>
          <Link to="/privacy-policy">
            Connection & privacy details <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
