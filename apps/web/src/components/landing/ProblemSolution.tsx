import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Table2,
} from "lucide-react";
const fragments = [
  { label: "Chat", Icon: MessageSquare },
  { label: "Email", Icon: Mail },
  { label: "Documents", Icon: FileText },
  { label: "Calendar", Icon: Calendar },
  { label: "Spreadsheets", Icon: Table2 },
];
export function ProblemSolution() {
  const [playConnections, setPlayConnections] = useState(true);
  const [isInView, setIsInView] = useState(true);
  const networkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const network = networkRef.current;
    if (!network || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    });
    observer.observe(network);
    return () => observer.disconnect();
  }, []);
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
          ref={networkRef}
          data-animate-connections={playConnections}
          data-connections-in-view={isInView}
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
            {[42, 146, 250, 354, 458].map((x, index) => (
              <g
                key={x}
                style={{ "--connection-index": index } as CSSProperties}
              >
                <path
                  className="lp-network-track"
                  pathLength="1"
                  d={`M ${x} 0 V 30 Q ${x} 62 250 78 V 110`}
                />
                <path
                  className="lp-network-signal"
                  pathLength="1"
                  d={`M ${x} 0 V 30 Q ${x} 62 250 78 V 110`}
                />
              </g>
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
          <button
            type="button"
            className="lp-network-motion-control"
            aria-pressed={playConnections}
            title={
              playConnections
                ? "Pause the connection animation"
                : "Play the connection animation"
            }
            onClick={() => setPlayConnections((playing) => !playing)}
          >
            {playConnections ? <Pause size={13} /> : <Play size={13} />}
            {playConnections ? "Pause connections" : "Play connections"}
          </button>
        </div>
      </div>
    </section>
  );
}
