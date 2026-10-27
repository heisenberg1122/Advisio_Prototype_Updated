import { FileText } from "lucide-react";

/** Shared visual primitive for the live ecosystem and future product stories. */
export function SharedResearchRecord({ audience }: { audience: string }) {
  return (
    <article
      className="lp-shared-record"
      aria-label="Illustrative shared research record"
    >
      <div className="lp-shared-record-bar">
        <img src="/ao-logo.png" alt="" />
        <span>Shared research record</span>
        <span className="lp-record-live-dot" aria-hidden="true" />
      </div>
      <div className="lp-shared-record-body">
        <p className="lp-record-label">Advisio research project</p>
        <h3>Advisio: A Research Advising and Management Platform</h3>
        <div className="lp-record-progress-label">
          <span>Chapter 3 / Methodology</span>
          <strong>
            72<span>%</span>
          </strong>
        </div>
        <div
          className="lp-record-progress"
          aria-label="Illustrative progress: 72 percent"
        >
          <span />
        </div>
        <div className="lp-record-meta">
          <span>
            <FileText size={12} aria-hidden="true" /> v1.3
          </span>
          <span className="lp-record-review">
            <span /> In review
          </span>
        </div>
      </div>
      <p className="lp-record-sample">Illustrative project · {audience} view</p>
    </article>
  );
}
