import { useEffect, useState } from "react";
import type { ResearchMilestone } from "./milestone-data";

function PreviewContent({ milestone }: { milestone: ResearchMilestone }) {
  const Icon = milestone.icon;
  return (
    <>
      <div className="lp-milestone-preview-icon">
        <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="lp-milestone-eyebrow">{milestone.eyebrow}</p>
      <h3>{milestone.title}</h3>
      <span
        className={`lp-milestone-badge ${milestone.tone ? `is-${milestone.tone}` : ""}`}
      >
        {milestone.badge}
      </span>
      <dl className="lp-milestone-fields">
        {milestone.fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {milestone.note && (
        <p className="lp-milestone-preview-note">{milestone.note}</p>
      )}
    </>
  );
}

export function MilestonePreview({
  milestone,
  index,
  total,
  animate = false,
}: {
  milestone: ResearchMilestone;
  index: number;
  total: number;
  animate?: boolean;
}) {
  const [transition, setTransition] = useState<{
    current: ResearchMilestone;
    previous: ResearchMilestone | null;
  }>({ current: milestone, previous: null });
  if (transition.current.id !== milestone.id)
    setTransition({
      current: milestone,
      previous: animate ? transition.current : null,
    });
  useEffect(() => {
    if (!transition.previous) return;
    const timer = window.setTimeout(
      () => setTransition((current) => ({ ...current, previous: null })),
      420,
    );
    return () => window.clearTimeout(timer);
  }, [transition.current.id, transition.previous]);

  return (
    <div className={`lp-milestone-preview ${animate ? "has-motion" : ""}`}>
      <div className="lp-milestone-preview-bar">
        <span>
          <img src="/ao-logo.png" alt="" />
          advisio.
        </span>
        <span>Illustrative workspace</span>
      </div>
      <p className="lp-milestone-project">
        Advisio: A Research Advising and Management Platform
      </p>
      <div className="lp-milestone-preview-body">
        {transition.previous && (
          <div
            className="lp-milestone-preview-content is-leaving"
            key={`previous-${transition.previous.id}`}
            aria-hidden="true"
          >
            <PreviewContent milestone={transition.previous} />
          </div>
        )}
        <div
          className="lp-milestone-preview-content is-entering"
          key={milestone.id}
        >
          <PreviewContent milestone={milestone} />
        </div>
      </div>
      <div className="lp-milestone-preview-footer">
        <span>
          Milestone {String(index + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
        <span>Sample project</span>
      </div>
    </div>
  );
}
