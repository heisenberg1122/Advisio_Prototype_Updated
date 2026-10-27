import type { CSSProperties } from "react";
import { Calendar, FileText, Mail, MessageSquare, Table2 } from "lucide-react";
const fragments = [
  { label: "Chat", Icon: MessageSquare },
  { label: "Email", Icon: Mail },
  { label: "Documents", Icon: FileText },
  { label: "Calendar", Icon: Calendar },
  { label: "Spreadsheets", Icon: Table2 },
];
export function ProblemSolution() {
  return (
    <section id="platform" className="lp-platform lp-section" data-scene>
      <div className="lp-container lp-platform-grid">
        <div className="lp-section-copy">
          <p className="lp-eyebrow">01 / A clearer connection</p>
          <h2>Research gets complicated when the process lives everywhere.</h2>
          <p>
            Documents here. Feedback there. Meetings, approvals, and revisions
            somewhere in between.
          </p>
          <p className="lp-emphasis">Bring the work back together.</p>
        </div>
        <div
          className="lp-network"
          aria-label="Scattered tools connect in one Advisio research workspace."
        >
          <div className="lp-fragments">
            {fragments.map(({ label, Icon }, index) => (
              <div
                key={label}
                className="lp-fragment"
                style={{ "--fragment-index": index } as CSSProperties}
              >
                <Icon size={17} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <svg
            className="lp-network-lines"
            viewBox="0 0 500 110"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {[42, 146, 250, 354, 458].map((x) => (
              <path
                key={x}
                pathLength="1"
                d={`M ${x} 0 V 30 Q ${x} 62 250 78 V 110`}
              />
            ))}
          </svg>
          <div className="lp-network-core">
            <img src="/ao-logo.png" alt="" />
            <strong>advisio</strong>
            <span>One research workspace</span>
          </div>
          <div className="lp-connected-labels">
            <span>Documents</span>
            <span>Feedback</span>
            <span>Consultations</span>
            <span>Milestones</span>
            <span>Reviews</span>
          </div>
        </div>
      </div>
    </section>
  );
}
