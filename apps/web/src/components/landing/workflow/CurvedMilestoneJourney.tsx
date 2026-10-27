import { useId, useLayoutEffect, useRef, type CSSProperties } from "react";
import { MilestoneNode } from "./MilestoneTimeline";
import { MilestonePreview } from "./MilestonePreview";
import type { ResearchMilestone } from "./milestone-data";

const rowHeight = 640;
const nodeX = (index: number) => (index % 2 === 0 ? 220 : 780);
const nodeY = (index: number) => rowHeight * (index + 0.5);

export function CurvedMilestoneJourney({
  milestones,
  active,
  progress,
  onSelect,
}: {
  milestones: readonly ResearchMilestone[];
  active: number;
  progress: number;
  onSelect: (index: number) => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGCircleElement>(null);
  const revealRef = useRef<SVGRectElement>(null);
  const revealId = useId();
  const route = milestones.reduce(
    (path, _, index) =>
      index === 0
        ? `M ${nodeX(0)} ${nodeY(0)}`
        : `${path} C ${nodeX(index - 1)} ${nodeY(index - 1) + rowHeight / 2}, ${nodeX(index)} ${nodeY(index) - rowHeight / 2}, ${nodeX(index)} ${nodeY(index)}`,
    "",
  );

  useLayoutEffect(() => {
    const path = pathRef.current;
    const tip = tipRef.current;
    const reveal = revealRef.current;
    if (!path || !tip || !reveal) return;
    const length = path.getTotalLength();
    if (!length) return;
    // Follow the viewport's vertical position, including through the bends.
    const targetY = nodeY(0) + progress * (nodeY(milestones.length - 1) - nodeY(0));
    let low = 0;
    let high = length;
    for (let iteration = 0; iteration < 18; iteration++) {
      const midpoint = (low + high) / 2;
      if (path.getPointAtLength(midpoint).y < targetY) low = midpoint;
      else high = midpoint;
    }
    const position = (low + high) / 2;
    const point = path.getPointAtLength(position);
    // Clip the full stroke and place its tip from the same SVG point. Unlike
    // normalized dashes, this stays aligned when the SVG scales horizontally.
    reveal.setAttribute("height", String(point.y));
    tip.setAttribute("cx", String(point.x));
    tip.setAttribute("cy", String(point.y));
  }, [progress, milestones.length]);

  return (
    <div
      className="lp-curved-journey"
      style={{ "--journey-row-height": `${rowHeight}px` } as CSSProperties}
    >
      <svg
        className="lp-curved-route"
        viewBox={`0 0 1000 ${milestones.length * rowHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={revealId} clipPathUnits="userSpaceOnUse">
            <rect ref={revealRef} x="0" y="0" width="1000" height={nodeY(0)} />
          </clipPath>
        </defs>
        <path className="lp-curved-route-track" d={route} />
        <path
          ref={pathRef}
          className="lp-curved-route-progress"
          d={route}
          clipPath={`url(#${revealId})`}
        />
        <circle ref={tipRef} className="lp-curved-route-tip" cx={nodeX(0)} cy={nodeY(0)} r="9" />
      </svg>
      <ol className="lp-curved-stops" aria-label="Research journey milestones">
        {milestones.map((milestone, index) => {
          const passedNode = progress >= 1 ||
            progress * (milestones.length - 1) * rowHeight > index * rowHeight + 12;
          const status = passedNode ? "completed" : index === active ? "current" : "upcoming";
          return (
            <li key={milestone.id} className={`lp-curved-stop is-${status}`}>
              <button
                type="button"
                className="lp-milestone-select lp-curved-select"
                onClick={() => onSelect(index)}
                aria-current={status === "current" ? "step" : undefined}
                aria-pressed={index === active}
                aria-controls={`journey-card-${milestone.id}`}
              >
                <MilestoneNode status={status} number={index + 1} />
                <span className="lp-milestone-label">
                  <strong>{milestone.label}</strong>
                  <span>{milestone.meta}</span>
                  <small>{status === "completed" ? "Completed" : status === "current" ? "Current milestone" : "Upcoming"}</small>
                </span>
              </button>
              <div className="lp-curved-card" id={`journey-card-${milestone.id}`}>
                <MilestonePreview milestone={milestone} index={index} total={milestones.length} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
