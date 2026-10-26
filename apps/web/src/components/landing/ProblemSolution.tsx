import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  FolderGit2,
} from "lucide-react";

export function ProblemSolution() {
  const problems = [
    {
      title: "Feedback buried in chat messages",
      desc: "Critiques and revisions get lost in group chats and private DMs without any traceable action items.",
      icon: MessageCircle,
    },
    {
      title: "Chaotic manuscript file versions",
      desc: "Confusing chains of 'final_v2_updated_FINAL.docx' lead to faculty reviewing outdated chapters.",
      icon: FileSpreadsheet,
    },
    {
      title: "Missed consultations & lost minutes",
      desc: "Meetings happen informally without recorded agreements, action items, or attendance proof.",
      icon: Clock,
    },
    {
      title: "Opaque progress monitoring",
      desc: "Deans and research directors have zero real-time visibility into student milestone bottlenecks.",
      icon: AlertTriangle,
    },
    {
      title: "Scattered evaluation records",
      desc: "Paper rubric sheets, disparate email threads, and untracked panel scores delay final defense clearance.",
      icon: Mail,
    },
  ];

  return (
    <section id="solution" className="py-20 lg:py-28 bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0b3553]">
            The Core Challenge
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-[40px] leading-[1.15]">
            Research shouldn&apos;t be scattered across chats, emails, files, and spreadsheets.
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Traditional thesis coordination fails because communication, document versioning, and formal authorizations are fragmented across dozens of disconnected tools.
          </p>
        </div>

        {/* 2-Column Split: The Problem vs The Advisio Solution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Column: Fragmented Problems */}
          <div className="rounded-2xl border border-rose-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-rose-100 pb-4 mb-6">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700">
                  The Fragmented Status Quo
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                  High Friction
                </span>
              </div>

              <div className="space-y-4">
                {problems.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.title}
                      className="flex items-start gap-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600 mt-0.5">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                          {p.title}
                        </strong>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
              Result: Disorganized defenses, delayed graduations, and unaccountable feedback.
            </div>
          </div>

          {/* Right Column: Unified Advisio Workspace Card */}
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-[#0b3553] to-[#123e61] p-6 sm:p-8 text-white shadow-xl shadow-[#0b3553]/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#ffb21c]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#ffb21c]">
                    The Advisio Solution
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                  Consolidated Workspace
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                One complete research ecosystem.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
                Every file revision, margin annotation, consultation log, and rubric evaluation stays pinned to the verifiable research record.
              </p>

              {/* UI Architecture Tree Mockup */}
              <div className="mt-6 rounded-xl bg-white/10 p-5 border border-white/15 backdrop-blur-md font-mono text-xs text-slate-200">
                <div className="flex items-center gap-2 font-bold text-[#ffb21c] mb-3 pb-2 border-b border-white/15">
                  <FolderGit2 className="h-4 w-4" />
                  <span>Research Project: Smart City Autonomous Grid</span>
                </div>

                <div className="space-y-2.5 pl-2">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">├</span>
                      <strong className="text-white font-sans text-xs">Documents:</strong>
                      <span>Locked Chapter 1–3 v1.2</span>
                    </span>
                    <span className="text-emerald-400 font-sans text-[11px] font-bold">Stamped</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">├</span>
                      <strong className="text-white font-sans text-xs">Adviser Feedback:</strong>
                      <span>Inline margin revisions</span>
                    </span>
                    <span className="text-[#ffb21c] font-sans text-[11px] font-bold">Traceable</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">├</span>
                      <strong className="text-white font-sans text-xs">Consultation Logs:</strong>
                      <span>Google Meet transcripts & minutes</span>
                    </span>
                    <span className="text-slate-300 font-sans text-[11px]">Recorded</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">├</span>
                      <strong className="text-white font-sans text-xs">Evaluations:</strong>
                      <span>Standardized institutional rubrics</span>
                    </span>
                    <span className="text-purple-300 font-sans text-[11px] font-bold">Live Scoring</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">├</span>
                      <strong className="text-white font-sans text-xs">Deadlines:</strong>
                      <span>Pre-oral presentation on Nov 13</span>
                    </span>
                    <span className="text-blue-300 font-sans text-[11px]">Synced</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-2">
                      <span className="text-white/40">└</span>
                      <strong className="text-white font-sans text-xs">Progress Tracking:</strong>
                      <span>Stage 3 of 4 (Methodology)</span>
                    </span>
                    <span className="text-emerald-400 font-sans text-[11px] font-bold">72%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/15 text-xs text-slate-300">
              <span>Zero lost revisions. Complete accountability.</span>
              <span className="font-bold text-[#ffb21c]">Ready for Defense</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
