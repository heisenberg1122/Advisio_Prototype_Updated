import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck2,
  Users,
  ShieldCheck,
  Building2,
  Award,
  Sparkles,
} from "lucide-react";

import { handleLandingTabKey } from "./landing-tabs";

type Stage = {
  id: number;
  number: string;
  title: string;
  status: "Completed" | "In Review" | "Upcoming";
  statusColor: string;
  lead: string;
  deliverables: string[];
  stakeholders: string[];
};

const STAGES: Stage[] = [
  {
    id: 1,
    number: "01",
    title: "Create Research Project",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Create your research group and establish a shared home for the project.",
    deliverables: ["Team Charter", "Scope Statement", "Topic Registration"],
    stakeholders: ["Student Researchers", "Research Coordinator"],
  },
  {
    id: 2,
    number: "02",
    title: "Connect & Assign Adviser",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Browse eligible faculty and request an adviser, subject to availability and acceptance.",
    deliverables: ["Adviser Request Form", "Workload Verification"],
    stakeholders: ["Lead Researcher", "Faculty Adviser", "Department Chair"],
  },
  {
    id: 3,
    number: "03",
    title: "Prepare & Submit Documents",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Upload manuscript drafts and supporting files against your assigned requirements.",
    deliverables: ["Chapter 1–3 Draft", "Similarity Index Report"],
    stakeholders: ["Research Team"],
  },
  {
    id: 4,
    number: "04",
    title: "Adviser Review & Annotation",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Review the submitted version, add contextual annotations, and record a decision.",
    deliverables: ["Annotated Manuscript", "Action Item Checklist"],
    stakeholders: ["Faculty Adviser"],
  },
  {
    id: 5,
    number: "05",
    title: "Consultation & Revision",
    status: "In Review",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    lead: "Meet with your adviser, record consultation notes, and submit the next revision.",
    deliverables: ["Consultation Log", "Revision Matrix v1.2"],
    stakeholders: ["Research Team", "Faculty Adviser"],
  },
  {
    id: 6,
    number: "06",
    title: "Panel Evaluation & Oral Defense",
    status: "Upcoming",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    lead: "Prepare the defense packet for assigned panelists and record rubric evaluations.",
    deliverables: ["Defense Review Packet", "Panelist Rubric Scores"],
    stakeholders: ["Panel Chair", "Panel Members", "Faculty Adviser"],
  },
  {
    id: 7,
    number: "07",
    title: "REB & Institutional Processing",
    status: "Upcoming",
    statusColor: "bg-slate-50 text-slate-700 border-slate-200",
    lead: "Route research protocols and supporting documents through the required institutional reviews.",
    deliverables: ["REB Ethics Certificate", "Compliance Clearance"],
    stakeholders: ["Ethics Committee", "Research Office"],
  },
  {
    id: 8,
    number: "08",
    title: "Final Archiving & Dean Clearance",
    status: "Upcoming",
    statusColor: "bg-slate-50 text-slate-700 border-slate-200",
    lead: "Record final clearances and preserve an official copy with document integrity verification.",
    deliverables: ["Cryptographic Official Copy", "Library Archive Deposit"],
    stakeholders: ["Academic Dean", "University Registrar", "Library"],
  },
];

export function WorkflowSection() {
  const [activeStageId, setActiveStageId] = useState(5);
  return (
    <section id="workflow" className="landing-section landing-workflow">
      <div className="landing-container">
        <div className="landing-section-heading landing-heading-split">
          <div>
            <p className="landing-eyebrow">A guided research journey</p>
            <h2>
              Every step.
              <br />A clear way forward.
            </h2>
          </div>
          <p>
            Follow the handoffs from proposal to official copy. This eight-step
            example illustrates a workflow; your institution defines its
            milestones and approvals.
          </p>
        </div>
        <div
          className="landing-workflow-tabs"
          role="tablist"
          aria-label="Example research workflow"
          onKeyDown={handleLandingTabKey}
        >
          {STAGES.map((stage) => (
            <button
              type="button"
              role="tab"
              id={`workflow-tab-${stage.id}`}
              aria-selected={activeStageId === stage.id}
              aria-controls={`workflow-panel-${stage.id}`}
              tabIndex={activeStageId === stage.id ? 0 : -1}
              onClick={() => setActiveStageId(stage.id)}
              key={stage.id}
            >
              <span>{stage.number}</span>
              <strong>{stage.title}</strong>
            </button>
          ))}
        </div>
        <div className="landing-panel-stack landing-workflow-panels">
          {STAGES.map((stage) => {
            const active = stage.id === activeStageId;
            return (
              <div
                key={stage.id}
                id={`workflow-panel-${stage.id}`}
                role="tabpanel"
                aria-labelledby={`workflow-tab-${stage.id}`}
                aria-hidden={!active}
                inert={!active}
                tabIndex={0}
                className={`landing-stable-panel landing-workflow-detail ${active ? "is-active" : ""}`}
              >
                <div>
                  <p className="landing-eyebrow">
                    Example workflow · Step {stage.number}
                  </p>
                  <h3>{stage.title}</h3>
                  <p className="landing-workflow-lead">{stage.lead}</p>
                  <div className="landing-workflow-lists">
                    <div>
                      <h4>Key deliverables</h4>
                      <ul>
                        {stage.deliverables.map((item) => (
                          <li key={item}>
                            <FileCheck2 size={16} aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>People involved</h4>
                      <ul>
                        {stage.stakeholders.map((item) => (
                          <li key={item}>
                            <Users size={16} aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <aside className="landing-workflow-note">
                  <span className="landing-step-number" aria-hidden="true">
                    {stage.number}
                  </span>
                  <div>
                    <span className="landing-sample-label">Sample status</span>
                    <p className="landing-workflow-status">
                      <span
                        className={`landing-status-dot ${stage.status === "Upcoming" ? "is-upcoming" : ""}`}
                      />
                      {stage.status}
                    </p>
                  </div>
                  <p>
                    Each handoff keeps the next action and responsible people in
                    view.
                  </p>
                  <button
                    type="button"
                    className="landing-text-link"
                    onClick={() => {
                      const next = stage.id < STAGES.length ? stage.id + 1 : 1;
                      setActiveStageId(next);
                      document
                        .getElementById(`workflow-tab-${next}`)
                        ?.focus({ preventScroll: true });
                    }}
                  >
                    Next step <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </aside>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
