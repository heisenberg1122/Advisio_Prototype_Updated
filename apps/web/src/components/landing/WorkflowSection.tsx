import { useEffect, useRef, useState } from "react";
import { Play, Pause, Route } from "lucide-react";
import { MilestoneTimeline } from "./workflow/MilestoneTimeline";
import { CurvedMilestoneJourney } from "./workflow/CurvedMilestoneJourney";
import { illustrativeMilestones } from "./workflow/milestone-data";
import "./workflow/milestone-journey.css";

const initialMilestone = 4;
const lastMilestone = illustrativeMilestones.length - 1;

export function WorkflowSection() {
  const [active, setActive] = useState(initialMilestone);
  const [progress, setProgress] = useState(initialMilestone / lastMilestone);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [playScrollStory, setPlayScrollStory] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(initialMilestone);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 900px)");
    let frame = 0;
    let disposed = false;
    let start = 0;
    let distance = 1;
    const enabled = () =>
      desktop.matches && (!preference.matches || playScrollStory);
    const update = () => {
      frame = 0;
      if (!enabled() || disposed) return;
      const nextProgress = Math.max(
        0,
        Math.min(
          1,
          (window.scrollY + window.innerHeight * 0.48 - start) / distance,
        ),
      );
      // Advance as soon as the tip clears a node by 12px, rather than waiting
      // until halfway to the next milestone (320px on the desktop route).
      const nextActive = Math.max(0, Math.min(lastMilestone,
        Math.ceil((nextProgress * distance - 12) / (distance / lastMilestone)),
      ));
      setProgress(nextProgress);
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
    };
    const schedule = () => {
      if (enabled() && !frame) frame = window.requestAnimationFrame(update);
    };
    const measure = () => {
      if (disposed) return;
      const nodes = Array.from(timeline.querySelectorAll<HTMLElement>(
        "[data-milestone-node]",
      )).filter((node) => node.getClientRects().length > 0);
      if (!nodes.length) return;
      const first = nodes[0].getBoundingClientRect();
      const last = nodes[nodes.length - 1].getBoundingClientRect();
      start = first.top + first.height / 2 + window.scrollY;
      distance = Math.max(
        1,
        last.top + last.height / 2 + window.scrollY - start,
      );
      schedule();
    };
    const configure = () => {
      setReducedMotion(preference.matches);
      if (!enabled()) setProgress(activeRef.current / lastMilestone);
      measure();
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(timeline);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    preference.addEventListener("change", configure);
    desktop.addEventListener("change", configure);
    document.fonts.ready.then(() => {
      if (!disposed) measure();
    });
    configure();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      preference.removeEventListener("change", configure);
      desktop.removeEventListener("change", configure);
    };
  }, [playScrollStory]);

  const selectMilestone = (index: number) => {
    activeRef.current = index;
    setActive(index);
    setProgress(index / lastMilestone);
  };
  const animate = !reducedMotion || playScrollStory;

  return (
    <section
      id="workflow"
      className="lp-journey lp-section lp-milestone-journey"
      data-scene
      data-story-motion={animate}
    >
      <div className="lp-container">
        <div className="lp-milestone-heading">
          <p className="lp-eyebrow">02 / The research journey</p>
          <h2>Every milestone has a place.</h2>
          <p>
            Advisio keeps each project&apos;s milestones, submissions, reviews,
            and decisions connected to its assigned research workflow.
          </p>
        </div>
        <div className="lp-milestone-context">
          <span>
            <Route size={14} aria-hidden="true" /> Illustrative research
            workflow
          </span>
          <span className="lp-milestone-scroll-hint">
            Scroll to follow the journey · Select to explore
          </span>
          <span className="lp-milestone-mobile-hint">
            Select a milestone to explore
          </span>
          {reducedMotion && (
            <button
              type="button"
              className="lp-scroll-story-control"
              aria-pressed={playScrollStory}
              onClick={() => setPlayScrollStory((playing) => !playing)}
            >
              {playScrollStory ? <Pause size={12} /> : <Play size={12} />}
              {playScrollStory ? "Reduce scroll motion" : "Enable scroll story"}
            </button>
          )}
        </div>
        <div ref={timelineRef}>
          <CurvedMilestoneJourney
            milestones={illustrativeMilestones}
            active={active}
            progress={progress}
            onSelect={selectMilestone}
          />
          <div className="lp-milestone-layout lp-milestone-compact-layout">
            <MilestoneTimeline
              milestones={illustrativeMilestones}
              active={active}
              progress={progress}
              onSelect={selectMilestone}
              animate={animate}
            />
          </div>
        </div>
        <p className="lp-milestone-config-note">
          An example journey. Milestones and requirements follow the workflow
          assigned by your institution.
        </p>
      </div>
    </section>
  );
}
