import { useEffect, useRef } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Users,
} from "lucide-react";

export function HeroProductVisual() {
  const visualRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const visual = visualRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const settle = () => {
      frame = 0;
      if (!visual) return;
      const rect = visual.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight - rect.top) / (window.innerHeight * 0.85),
        ),
      );
      visual.style.setProperty(
        "--settle-tilt",
        motion.matches ? "0deg" : `${(1 - progress) * 5}deg`,
      );
      visual.style.setProperty(
        "--settle-scale",
        motion.matches ? "1" : `${0.97 + progress * 0.03}`,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(settle);
    };
    const resetPointer = () => {
      visual?.style.setProperty("--pointer-x", "0px");
      visual?.style.setProperty("--pointer-tilt", "0deg");
    };
    const onPointer = (event: PointerEvent) => {
      if (!visual || motion.matches || !pointer.matches) return;
      const rect = visual.getBoundingClientRect();
      const x = Math.max(
        -0.5,
        Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5),
      );
      visual.style.setProperty("--pointer-x", `${x * 8}px`);
      visual.style.setProperty("--pointer-tilt", `${x * 1.5}deg`);
    };
    settle();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    motion.addEventListener("change", onScroll);
    visual?.addEventListener("pointermove", onPointer);
    visual?.addEventListener("pointerleave", resetPointer);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onScroll);
      visual?.removeEventListener("pointermove", onPointer);
      visual?.removeEventListener("pointerleave", resetPointer);
    };
  }, []);
  return (
    <div className="lp-product-stage" ref={visualRef}>
      <div
        className="lp-workspace"
        role="img"
        aria-label="Illustrative researcher workspace showing a project at 72 percent, adviser feedback, and an upcoming consultation. Sample data."
      >
        <div className="lp-window-bar">
          <div className="lp-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>Advisio / Researcher workspace</span>
          <span className="lp-sample">Illustrative workspace</span>
        </div>
        <div className="lp-workspace-layout">
          <aside className="lp-preview-sidebar" aria-hidden="true">
            <div className="lp-preview-brand">
              <img src="/ao-logo.png" alt="" /> advisio<span>®</span>
            </div>
            <span className="lp-micro">Workspace</span>
            <div className="lp-preview-nav is-active">
              <LayoutDashboard /> Overview
            </div>
            <div className="lp-preview-nav">
              <BookOpen /> My research
            </div>
            <div className="lp-preview-nav">
              <FileText /> Documents <span>3</span>
            </div>
            <div className="lp-preview-nav">
              <MessageSquare /> Feedback
            </div>
            <div className="lp-preview-nav">
              <Calendar /> Consultations
            </div>
            <div className="lp-preview-person">
              <span className="lp-avatar">NS</span>
              <div>
                Nicole Santos<small>Researcher</small>
              </div>
            </div>
          </aside>
          <div className="lp-preview-main">
            <div className="lp-preview-top">
              <div>
                <span className="lp-micro">Your research, at a glance</span>
                <h2>A little closer to your next milestone.</h2>
              </div>
              <span className="lp-avatar">
                <Users size={17} />
              </span>
            </div>
            <div className="lp-research-card">
              <div className="lp-row">
                <span className="lp-micro">IT Capstone · Research project</span>
                <span className="lp-badge">In progress</span>
              </div>
              <h3>
                Advisio: A Research Advising
                <br className="lp-desktop-break" /> and Management Platform
              </h3>
              <div className="lp-progress-caption">
                <span>Chapter 3 / Methodology</span>
                <strong>
                  72<span>%</span>
                </strong>
              </div>
              <div className="lp-progress" aria-hidden="true">
                <span style={{ width: "72%" }} />
              </div>
              <div className="lp-research-meta">
                <div>
                  <span className="lp-avatar">EV</span>
                  <div>
                    <small>Your adviser</small>
                    <strong>Dr. Evelyn Vance</strong>
                  </div>
                </div>
                <div>
                  <Calendar size={18} />
                  <div>
                    <small>Next consultation</small>
                    <strong>Oct 29 · 2:00 PM</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-feedback-strip">
              <span className="lp-feedback-icon">
                <MessageSquare size={17} />
              </span>
              <div>
                <span className="lp-micro">A note from your adviser</span>
                <p>
                  “Please revise the sampling procedure before our next
                  consultation.”
                </p>
              </div>
              <span className="lp-feedback-version">Chapter 3 · v1.2</span>
            </div>
            <div className="lp-preview-bottom">
              <span>
                <Check size={13} /> Proposal approved
              </span>
              <span>
                <Check size={13} /> Adviser connected
              </span>
              <span>
                <span className="lp-status-dot" /> Methodology in progress
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="lp-float-chip lp-float-one" aria-hidden="true">
        <CheckCircle2 size={19} />
        <div>
          <small>Milestone approved</small>
          <strong>One step further.</strong>
        </div>
      </div>
      <div className="lp-float-chip lp-float-two" aria-hidden="true">
        <MessageSquare size={18} />
        <div>
          <small>New feedback</small>
          <strong>Guidance, right where you need it.</strong>
        </div>
      </div>
    </div>
  );
}
