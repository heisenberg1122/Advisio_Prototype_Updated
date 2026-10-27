import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import {
  milestoneStatus,
  type MilestoneStatus,
  type ResearchMilestone,
} from "./milestone-data";
import { MilestonePreview } from "./MilestonePreview";

export function MilestoneNode({
  status,
  number,
}: {
  status: MilestoneStatus;
  number: number;
}) {
  return (
    <span
      className={`lp-milestone-node is-${status}`}
      data-milestone-node
      aria-hidden="true"
    >
      {status === "completed" ? (
        <Check size={15} strokeWidth={1.8} />
      ) : status === "current" ? (
        <span />
      ) : (
        <span className="lp-milestone-number">
          {String(number).padStart(2, "0")}
        </span>
      )}
    </span>
  );
}

export function MilestoneTimeline({
  milestones,
  active,
  progress,
  onSelect,
  animate,
}: {
  milestones: readonly ResearchMilestone[];
  active: number;
  progress: number;
  onSelect: (index: number) => void;
  animate: boolean;
}) {
  return (
    <div
      className="lp-milestone-timeline"
      style={{ "--milestone-progress": progress } as CSSProperties}
    >
      <div className="lp-milestone-spine" aria-hidden="true">
        <span />
      </div>
      <ol>
        {milestones.map((milestone, index) => {
          const status = milestoneStatus(index, active);
          return (
            <li key={milestone.id} className={`lp-milestone-step is-${status}`}>
              <button
                type="button"
                className="lp-milestone-select"
                onClick={() => onSelect(index)}
                aria-pressed={index === active}
                aria-current={index === active ? "step" : undefined}
                aria-controls="workflow-preview-mobile"
              >
                <MilestoneNode status={status} number={index + 1} />
                <span className="lp-milestone-label">
                  <strong>{milestone.label}</strong>
                  <span>{milestone.meta}</span>
                  <small>
                    {status === "completed"
                      ? "Completed"
                      : status === "current"
                        ? "Current milestone"
                        : "Upcoming"}
                  </small>
                </span>
              </button>
              {index === active && (
                <div
                  className="lp-milestone-mobile-preview"
                  id="workflow-preview-mobile"
                >
                  <MilestonePreview
                    milestone={milestone}
                    index={index}
                    total={milestones.length}
                    animate={animate}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
