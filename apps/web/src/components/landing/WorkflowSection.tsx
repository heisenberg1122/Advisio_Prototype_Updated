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
    lead: "Researchers register team charters, declare tentative titles, and set up collaborative repository workspaces.",
    deliverables: ["Team Charter", "Scope Statement", "Topic Registration"],
    stakeholders: ["Student Researchers", "Research Coordinator"],
  },
  {
    id: 2,
    number: "02",
    title: "Connect & Assign Adviser",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Groups browse accredited faculty profiles based on research interests and submit formal advising requests within departmental quotas.",
    deliverables: ["Adviser Request Form", "Workload Verification"],
    stakeholders: ["Lead Researcher", "Faculty Adviser", "Department Chair"],
  },
  {
    id: 3,
    number: "03",
    title: "Prepare & Submit Documents",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Authors submit structured manuscript chapters (1–3) with automated version labeling and citation verification.",
    deliverables: ["Chapter 1–3 Draft", "Similarity Index Report"],
    stakeholders: ["Research Team"],
  },
  {
    id: 4,
    number: "04",
    title: "Adviser Review & Annotation",
    status: "Completed",
    statusColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    lead: "Faculty mentors examine manuscripts with line-by-line digital margin annotations and revision requirement stamps.",
    deliverables: ["Annotated Manuscript", "Action Item Checklist"],
    stakeholders: ["Faculty Adviser"],
  },
  {
    id: 5,
    number: "05",
    title: "Consultation & Revision",
    status: "In Review",
    statusColor: "bg-amber-50 text-amber-700 border-amber-200",
    lead: "Conduct Google Meet or on-site consultations, log meeting minutes, and submit resolved revision packets.",
    deliverables: ["Consultation Log", "Revision Matrix v1.2"],
    stakeholders: ["Research Team", "Faculty Adviser"],
  },
  {
    id: 6,
    number: "06",
    title: "Panel Evaluation & Oral Defense",
    status: "Upcoming",
    statusColor: "bg-blue-50 text-blue-700 border-blue-200",
    lead: "Convening examination committee evaluates candidate presentation live against university rubric benchmarks.",
    deliverables: ["Defense Review Packet", "Panelist Rubric Scores"],
    stakeholders: ["Panel Chair", "Panel Members", "Faculty Adviser"],
  },
  {
    id: 7,
    number: "07",
    title: "REB & Institutional Processing",
    status: "Upcoming",
    statusColor: "bg-slate-50 text-slate-700 border-slate-200",
    lead: "Research Ethics Board reviews methodology protocols, human subject consent forms, and institutional compliance.",
    deliverables: ["REB Ethics Certificate", "Compliance Clearance"],
    stakeholders: ["Ethics Committee", "Research Office"],
  },
  {
    id: 8,
    number: "08",
    title: "Final Archiving & Dean Clearance",
    status: "Upcoming",
    statusColor: "bg-slate-50 text-slate-700 border-slate-200",
    lead: "Approved manuscripts receive cryptographic integrity stamps, dean endorsement signatures, and institutional repository archiving.",
    deliverables: ["Cryptographic Official Copy", "Library Archive Deposit"],
    stakeholders: ["Academic Dean", "University Registrar", "Library"],
  },
];

export function WorkflowSection() {
  const [activeStageId, setActiveStageId] = useState(5);
  const activeStage = STAGES.find((s) => s.id === activeStageId) || STAGES[4];

  return (
    <section id="workflow" className="py-20 lg:py-28 bg-[#f8fafc] border-y border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0b3553]">
            Structured Academic Progress
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-[40px] leading-tight">
            From proposal to completion, Advisio keeps every step connected.
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Eliminate ambiguity with a verified 8-stage research pipeline where every handoff, review, and authorization is traceable.
          </p>
        </div>

        {/* 8-Stage Stepper Bar */}
        <div className="mb-10 overflow-x-auto pb-4 scrollbar-thin">
          <div className="flex items-center min-w-[800px] gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
            {STAGES.map((stage) => {
              const isSelected = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageId(stage.id)}
                  aria-pressed={isSelected}
                  className={`flex-1 flex flex-col items-start p-3 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#0b3553] text-white shadow-sm"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span
                      className={`font-mono text-xs font-black ${
                        isSelected ? "text-[#ffad14]" : "text-slate-400"
                      }`}
                    >
                      {stage.number}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                        isSelected
                          ? "bg-white/20 text-white border-white/30"
                          : stage.statusColor
                      }`}
                    >
                      {stage.status}
                    </span>
                  </div>
                  <strong className="text-xs font-bold truncate w-full block">
                    {stage.title}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Detail Showcase Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-black text-[#ffad14]">
                  Stage {activeStage.number}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${activeStage.statusColor}`}>
                  {activeStage.status}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0b3553]">
                {activeStage.title}
              </h3>

              <p className="text-base text-slate-600 leading-relaxed">
                {activeStage.lead}
              </p>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Key Deliverables
                  </h4>
                  <ul className="space-y-1.5">
                    {activeStage.deliverables.map((del) => (
                      <li key={del} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{del}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Responsible Stakeholders
                  </h4>
                  <ul className="space-y-1.5">
                    {activeStage.stakeholders.map((person) => (
                      <li key={person} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <Users className="h-3.5 w-3.5 text-[#0b3553] shrink-0" />
                        <span>{person}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Stage Quick Preview Mini-Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0b3553] block mb-2">
                  Institutional Verification
                </span>
                <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-xs mb-3 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">Stage Milestone</span>
                    <span className="text-emerald-700 font-bold">Sign-off Ready</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    All prerequisites verified against program curriculum guidelines.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Progress: {activeStage.id} of 8</span>
                <button
                  type="button"
                  onClick={() => setActiveStageId((prev) => (prev < 8 ? prev + 1 : 1))}
                  className="font-bold text-[#0b3553] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
