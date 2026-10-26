import React from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Award,
  Video,
  BarChart3,
  Bell,
  Building2,
  FileSignature,
  FileCode2,
} from "lucide-react";

export function FeatureBento() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0b3553]">
            Comprehensive Capabilities
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-[40px] leading-tight">
            Everything your research journey needs.
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Engineered specifically to satisfy rigorous institutional governance, academic deadlines, and multi-department advising loads.
          </p>
        </div>

        {/* Bento Grid with Varied Card Sizes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Research Workspace (Span 2 Columns on Large Screens) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b3553] text-white">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  Core Hub
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#0b3553]">
                Centralized Research Workspace
              </h3>
              <p className="mt-2 text-sm text-slate-600 max-w-xl leading-relaxed">
                A single unified cockpit for managing project charters, milestones, group rosters, and defense checklists across every phase of study.
              </p>
            </div>

            {/* Interactive Preview: Milestone Progress Strip */}
            <div className="mt-6 rounded-xl bg-white p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700">Milestone Velocity Tracking</span>
                <span className="font-mono font-bold text-[#0b3553]">4 of 5 Chapters Endorsed</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {["Title Defense", "Proposal", "Methodology", "Results", "Final Oral"].map((stage, i) => (
                  <div key={stage} className="text-center">
                    <div
                      className={`h-2 rounded-full ${
                        i < 4 ? "bg-[#0b3553]" : "bg-slate-200"
                      }`}
                    />
                    <span className="mt-1 block text-[10px] font-semibold text-slate-500 truncate">
                      {stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Document Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs text-slate-400 font-bold">
                  v1.2 Current
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0b3553]">
                Document Management & Versioning
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Upload, organize, review, and track research drafts. Every revision retains its diff history and cryptographic integrity hash.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs font-mono space-y-1.5">
              <div className="flex justify-between items-center text-slate-700">
                <span>Chapter3_Methodology_v1.2.pdf</span>
                <span className="text-emerald-600 font-bold">Verified</span>
              </div>
              <div className="text-[10px] text-slate-400">
                SHA-256: 8f9b...a12c · Oct 24, 2026
              </div>
            </div>
          </div>

          {/* Card 3: Adviser Collaboration */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  Inline Reviews
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0b3553]">
                Structured Adviser Mentorship
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Equip advisers with paragraph-level margin annotations, digital sign-off stamps, and organized revision request threads.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-purple-50/60 p-3.5 border border-purple-100 text-xs">
              <span className="font-bold text-purple-900 block">Adviser Note:</span>
              <p className="text-purple-800 text-[11px] mt-0.5 italic">
                &ldquo;Hypothesis section is clear. Refine sample size justification before submitting.&rdquo;
              </p>
            </div>
          </div>

          {/* Card 4: Consultation Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  Calendar Sync
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0b3553]">
                Consultation Management
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Book advising slots with automated Google Meet video links, real-time reminders, and verifiable consultation attendance transcripts.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Next Slot: Oct 29 · 2:00 PM</span>
              <span className="text-emerald-600 font-bold">Confirmed</span>
            </div>
          </div>

          {/* Card 5: Evaluation & Panel Review */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                  <Award className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Defense Rubrics
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0b3553]">
                Panel Examination & Scoring
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Deliver compiled defense packets to committee members. Collect synchronized rubric scores and lock formal pass/revision recommendations.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-emerald-50/70 p-3 border border-emerald-200/60 text-xs">
              <span className="font-semibold text-emerald-900">Score Consensus: 92.4 / 100</span>
              <span className="text-emerald-700 font-bold">Approved</span>
            </div>
          </div>

          {/* Card 6: Research Monitoring & Admin Analytics (Span 2 Columns on Large Screens) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b3553] text-white">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  Dean & Coordinator View
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#0b3553]">
                Institutional Research Monitoring
              </h3>
              <p className="mt-2 text-sm text-slate-600 max-w-xl leading-relaxed">
                Enable academic deans and coordinators to oversee hundreds of thesis groups, evaluate faculty advising loads, and identify at-risk cohorts early.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Cohorts", val: "128" },
                { label: "Reviews Pending", val: "24" },
                { label: "Pass Rate", val: "94.6%" },
                { label: "Avg Turnaround", val: "2.4 days" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white p-3 border border-slate-200 text-center">
                  <span className="block font-mono font-bold text-lg text-[#0b3553] tabular-nums">
                    {stat.val}
                  </span>
                  <span className="block text-[11px] text-slate-500 font-medium">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 7: REB & Research Office Workflow */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col justify-between hover:border-[#0b3553]/40 hover:shadow-lg transition-all duration-200">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Ethics & Archive
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0b3553]">
                REB & Research Office Clearance
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Manage ethics compliance protocols, consent forms, and final dean clearance stamps required for institutional library archiving.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs flex justify-between items-center">
              <span className="font-semibold text-slate-700">REB Clearance Certificate</span>
              <span className="text-emerald-600 font-bold">Issued</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
