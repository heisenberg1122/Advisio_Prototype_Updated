import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  MessageSquare,
  History,
  CornerDownRight,
  Sparkles,
  Download,
  Share2,
  Eye,
  Check,
} from "lucide-react";

export function CollaborationSection() {
  const [selectedVersion, setSelectedVersion] = useState("v1.2");
  const [resolvedStatus, setResolvedStatus] = useState(true);

  const versions = [
    {
      id: "v1.2",
      label: "v1.2",
      title: "Methodology Revised Draft",
      author: "Nicole Santos (Lead)",
      timestamp: "Oct 26, 2026 · 11:42 AM",
      badge: "Current · Endorsed",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      active: true,
    },
    {
      id: "v1.1",
      label: "v1.1",
      title: "Adviser Margin Notes Added",
      author: "Dr. Evelyn Vance",
      timestamp: "Oct 22, 2026 · 3:15 PM",
      badge: "4 Comments",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      active: false,
    },
    {
      id: "v1.0",
      label: "v1.0",
      title: "Initial Chapter 3 Draft",
      author: "Group 4 Researchers",
      timestamp: "Oct 15, 2026 · 9:00 AM",
      badge: "Archived",
      badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
      active: false,
    },
  ];

  return (
    <section id="collaboration" className="relative py-24 sm:py-32 bg-white overflow-hidden">
      {/* Decorative subtle background grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(#0b3553_1px,transparent_1px),linear-gradient(90deg,#0b3553_1px,transparent_1px)] [background-size:40px_40px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0b3553]/15 bg-[#0b3553]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0b3553]">
            <Sparkles className="h-3.5 w-3.5 text-[#ffad14]" />
            <span>Manuscript Collaboration · Interactive Preview</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-5xl text-balance">
            Clear feedback. No lost revisions.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
            Advisio eliminates messy email threads and conflicting document copies with an integrated chapter review canvas. Advisers annotate directly in the margin, student researchers resolve points systematically, and the complete revision history remains permanently accountable.
          </p>
        </div>

        {/* Interactive Workspace Mockup */}
        <div className="mt-14 rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
          {/* Top Document Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b3553] text-white shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-sans text-sm font-bold text-[#0b3553]">
                    Chapter 3 – Research Methodology.docx
                  </h3>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                    v1.2 Current
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Last updated Oct 26, 2026 · Advised by Dr. Evelyn Vance · 4,820 words
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 shadow-2xs">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                <span>2 Active Reviewers</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Packet</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b3553] px-3.5 py-1.5 font-bold text-white shadow-2xs hover:bg-[#124569]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export PDF</span>
              </span>
            </div>
          </div>

          {/* Main Document & Annotation Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Left: Document Excerpt & Inline Highlighting */}
            <div className="p-6 sm:p-8 bg-white font-sans text-slate-800">
              {/* Academic Paper Header */}
              <div className="border-b border-slate-100 pb-5 mb-6">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0b3553]/70">
                  Section 3.2 · Research Design & Sampling Protocol
                </span>
                <h4 className="mt-1 text-xl font-extrabold text-[#0b3553]">
                  3.2 Participants and Sampling Method
                </h4>
              </div>

              {/* Manuscript Text with Callout and Highlight */}
              <div className="space-y-4 text-sm leading-relaxed text-slate-700 font-serif">
                <p>
                  To rigorously evaluate the adoption curve of distributed institutional advisory platforms, this study employed a multi-stage stratified random sampling framework. The target population comprised undergraduate seniors, faculty mentors, and academic administrators across four degree-granting colleges.
                </p>

                {/* Highlighted text passage */}
                <div className="relative rounded-lg bg-amber-50/80 p-3.5 border-l-4 border-amber-400 font-serif text-slate-900 transition-colors">
                  <span className="inline-block bg-amber-200/60 px-1 py-0.5 rounded font-medium">
                    "A stratified sampling formula was determined to establish proportional representation across engineering, computing, and social sciences cohorts (N = 450, 95% confidence interval, 5% margin of error)."
                  </span>
                  <div className="mt-2 flex items-center justify-between font-sans text-[11px] font-semibold text-amber-800">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                      <span>1 Margin Comment Linked</span>
                    </span>
                    <span className="text-amber-700">Adviser Revision Note #04</span>
                  </div>
                </div>

                <p>
                  Data collection instruments were administered digitally via university single sign-on credentials. Instrument validity was established through panel evaluation using a 5-point Likert alignment rubric, yielding an average content validity index (CVI) of 0.94 across five domain experts.
                </p>

                <p className="text-slate-500 italic">
                  [Section 3.3 Data Analysis & Statistical Treatment continues...]
                </p>
              </div>

              {/* Integrated Adviser Endorsement Banner */}
              <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-950">
                      Adviser Endorsement Status
                    </h5>
                    <p className="text-[11px] text-emerald-800">
                      Chapter 3 revisions approved by Dr. Evelyn Vance. Eligible for Pre-Oral Defense Packet.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs">
                  Endorsed
                </span>
              </div>
            </div>

            {/* Right: Adviser Feedback Thread & Version Stack */}
            <div className="bg-slate-50/70 p-6 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0b3553]">
                    Active Comment Thread
                  </span>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                    Comment #04
                  </span>
                </div>

                {/* Adviser Comment Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b3553] text-white text-xs font-bold">
                        EV
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#0b3553]">
                            Dr. Evelyn Vance
                          </span>
                          <span className="rounded bg-[#ffad14]/20 px-1.5 py-0.2 text-[9px] font-extrabold text-[#966b08]">
                            ADVISER
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Oct 22, 2026 · 3:20 PM
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-700">
                    "Please revise the sampling procedure before the next consultation. Ensure the stratification formula explicitly accounts for faculty vs. undergraduate response rates."
                  </p>

                  {/* Student Response Thread */}
                  <div className="mt-3.5 rounded-lg border-l-2 border-[#0b3553] bg-slate-50 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <CornerDownRight className="h-3 w-3 text-slate-400" />
                      <span className="font-bold text-[#0b3553]">Nicole Santos</span>
                      <span className="text-[10px] text-slate-400">Oct 26 · 11:30 AM</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 leading-normal pl-4.5">
                      "Updated in Section 3.2 with proportional weighting formula and verified response coefficients."
                    </p>
                  </div>

                  {/* Status Toggle / Resolution Badge */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setResolvedStatus(!resolvedStatus)}
                      aria-pressed={resolvedStatus}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
                        resolvedStatus ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          resolvedStatus
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {resolvedStatus && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <span>{resolvedStatus ? "Marked as Resolved" : "Pending Verification"}</span>
                    </button>
                    <span className="text-[10px] font-mono text-slate-400">
                      Sign-off Ready
                    </span>
                  </div>
                </div>

                {/* Revision History Stack */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0b3553]">
                      <History className="h-3.5 w-3.5 text-slate-400" />
                      <span>Version History</span>
                    </span>
                    <span className="text-[11px] text-slate-500">3 Revisions</span>
                  </div>

                  <div className="space-y-2">
                    {versions.map((ver) => (
                      <button
                        type="button"
                        key={ver.id}
                        onClick={() => setSelectedVersion(ver.id)}
                        aria-pressed={selectedVersion === ver.id}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          selectedVersion === ver.id
                            ? "bg-white border-[#0b3553] shadow-xs ring-1 ring-[#0b3553]/20"
                            : "bg-white/60 border-slate-200 hover:bg-white"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="font-bold text-[#0b3553]">{ver.label}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${ver.badgeColor}`}
                          >
                            {ver.badge}
                          </span>
                        </span>
                        <span className="block mt-1 font-semibold text-slate-700 text-[11px]">
                          {ver.title}
                        </span>
                        <span className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{ver.author}</span>
                          <span className="font-mono">{ver.timestamp}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audit Stamp Pill */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-[#0b3553]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Immutable Audit Record</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 font-mono">
                  SHA-256: 7f8a92...c014d (Verified Institutional Ledger)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6">
            <h4 className="font-bold text-[#0b3553] text-base">
              Line-by-Line Context
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every note links directly to exact sentences and equations in the draft. No ambiguous bullet points or misplaced feedback.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6">
            <h4 className="font-bold text-[#0b3553] text-base">
              Complete Revision Diff
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Advisers can compare any draft with previous submissions to inspect additions, deletions, and structural amendments instantly.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6">
            <h4 className="font-bold text-[#0b3553] text-base">
              Digital Signature Endorsement
            </h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Once required revisions are met, faculty mentors sign off digitally to officially release defense packets to the examination panel.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
