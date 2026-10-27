import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";

const phases = [
  {
    name: "Begin",
    title: "Give your idea a place to grow.",
    copy: "Create your research project. Bring your team and adviser into the same workspace.",
    label: "A connected beginning",
    status: "Project created",
    Icon: Users,
    items: [
      "Research project registered",
      "Team members connected",
      "Adviser assigned",
    ],
  },
  {
    name: "Develop",
    title: "Keep the conversation close to the work.",
    copy: "Move between documents, consultations, and revisions with the context intact.",
    label: "Chapter 3 / Methodology",
    status: "Revision in progress",
    Icon: MessageSquare,
    items: [
      "Manuscript v1.3 uploaded",
      "Adviser annotation · Section 3.2",
      "Consultation confirmed",
    ],
  },
  {
    name: "Review",
    title: "Make every handoff a little clearer.",
    copy: "Bring adviser reviews, panel evaluations, and institutional requirements into view.",
    label: "Research evaluation",
    status: "Under review",
    Icon: FileText,
    items: [
      "Manuscript submitted",
      "Panel evaluation recorded",
      "Institutional review pending",
    ],
  },
  {
    name: "Complete",
    title: "Finish with a record of the journey.",
    copy: "Follow final approvals and keep your research record connected to the work behind it.",
    label: "Final research record",
    status: "Milestone approved",
    Icon: CheckCircle2,
    items: [
      "Final revision accepted",
      "Approval recorded",
      "Research record retained",
    ],
  },
];

export function WorkflowSection() {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 900px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!desktop.matches || motion.matches) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0])
          setActive(Number((visible[0].target as HTMLElement).dataset.phase));
      },
      { rootMargin: "-25% 0px -40% 0px", threshold: [0, 0.3, 0.6] },
    );
    stepsRef.current
      ?.querySelectorAll("[data-phase]")
      .forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);
  const phase = phases[active];
  const Icon = phase.Icon;
  return (
    <section id="workflow" className="lp-journey lp-section" data-scene>
      <div className="lp-container">
        <div className="lp-journey-heading">
          <p className="lp-eyebrow">02 / The research journey</p>
          <h2>
            Every next step.
            <br />
            Connected to the last.
          </h2>
          <p>From the first idea to the final record.</p>
        </div>
        <div className="lp-journey-layout">
          <ol className="lp-phase-list" ref={stepsRef}>
            {phases.map((item, index) => (
              <li
                key={item.name}
                data-phase={index}
                className={active === index ? "is-active" : ""}
              >
                <button
                  type="button"
                  aria-controls="workflow-preview"
                  aria-pressed={active === index}
                  onClick={() => setActive(index)}
                >
                  <span className="lp-phase-number">0{index + 1}</span>
                  <span className="lp-phase-copy">
                    <span className="lp-eyebrow">{item.name}</span>
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="lp-journey-preview" id="workflow-preview">
            <div className="lp-mobile-phase-copy" key={phase.name}>
              <h3>{phase.title}</h3>
              <p>{phase.copy}</p>
            </div>
            <div className="lp-story-frame">
              <div className="lp-story-top">
                <span className="lp-story-brand">advisio.</span>
                <span className="lp-sample">Illustrative workspace</span>
              </div>
              <div className="lp-story-content" key={active}>
                <span className="lp-story-icon">
                  <Icon size={27} />
                </span>
                <p className="lp-micro">Research workspace / {phase.name}</p>
                <h3>{phase.label}</h3>
                <span
                  className={`lp-badge ${active === 3 ? "is-complete" : ""}`}
                >
                  {phase.status}
                </span>
                <div className="lp-story-items">
                  {phase.items.map((item, index) => (
                    <div key={item}>
                      <span
                        className={active === 3 || index === 0 ? "is-done" : ""}
                      >
                        {active === 3 || index === 0 ? (
                          <Check size={13} />
                        ) : (
                          <span />
                        )}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lp-story-progress" aria-hidden="true">
                {phases.map((item, index) => (
                  <span
                    key={item.name}
                    className={index <= active ? "is-active" : ""}
                  />
                ))}
              </div>
            </div>
            <p className="lp-preview-note">
              One journey. Flexible milestones, shaped by your institution.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
