import React from "react";
import {
  BarChart3,
  TrendingUp,
  FileCheck2,
  Calendar,
  AlertCircle,
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

export function AnalyticsSection() {
  const departmentBreakdown = [
    { name: "College of Computing & Informatics", active: 48, rate: "94% on-track", bar: "w-[94%]" },
    { name: "College of Engineering & Architecture", active: 36, rate: "89% on-track", bar: "w-[89%]" },
    { name: "College of Health & Allied Sciences", active: 26, rate: "92% on-track", bar: "w-[92%]" },
    { name: "College of Business & Public Governance", active: 18, rate: "96% on-track", bar: "w-[96%]" },
  ];

  return (
    <section id="analytics" className="relative py-24 sm:py-32 bg-slate-50 border-y border-slate-200/80 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0b3553]/15 bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0b3553] shadow-2xs">
            <BarChart3 className="h-3.5 w-3.5 text-[#ffad14]" />
            <span>Institutional Oversight · Sample Data</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-5xl text-balance">
            See the bigger picture.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
            Advisio provides Deans, Department Chairs, and Research Coordinators comprehensive real-time visibility into student progress, faculty advisory capacity, and upcoming defense examination schedules.
          </p>
        </div>

        {/* 4 Key Metric Cards */}
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Active Projects</span>
              <GraduationCap className="h-5 w-5 text-[#0b3553]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0b3553] tabular-nums">
                128
              </span>
              <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
                +14% YoY
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Across 4 colleges & 12 undergraduate degree programs
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Reviews</span>
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0b3553] tabular-nums">
                24
              </span>
              <span className="text-xs font-semibold text-slate-500">
                in queue
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Avg. turnaround: <strong>4.2 days</strong> (down from 18 days)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Defended & Archived</span>
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0b3553] tabular-nums">
                43
              </span>
              <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                100% compliant
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Official copies verified with cryptographic checksums
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Upcoming Defenses</span>
              <Calendar className="h-5 w-5 text-[#ffad14]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0b3553] tabular-nums">
                12
              </span>
              <span className="text-xs font-semibold text-slate-500">
                next 14 days
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Panels constituted with full academic quorum
            </p>
          </div>
        </div>

        {/* Dashboard Analytics View Container */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* Left: Research Pipeline Stages & Velocity */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0b3553]">
                  Institutional Research Pipeline Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Current active projects categorised by developmental milestone
                </p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Fall 2026 Term
              </span>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Pipeline Stage Breakdown</span>
                <span className="text-[#0b3553]">128 Manuscripts Active</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 flex shadow-inner">
                <div style={{ width: "22%" }} className="bg-[#0b3553] title='Title Proposal'" />
                <div style={{ width: "35%" }} className="bg-[#1a5a8a] title='Chapter Advising'" />
                <div style={{ width: "25%" }} className="bg-[#ffad14] title='Defense Evaluation'" />
                <div style={{ width: "18%" }} className="bg-emerald-500 title='Final Archive'" />
              </div>

              {/* Legend with counts */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[#0b3553]" />
                  <div>
                    <span className="block font-bold text-slate-800">Proposal</span>
                    <span className="text-[11px] text-slate-500">28 (22%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[#1a5a8a]" />
                  <div>
                    <span className="block font-bold text-slate-800">Draft Advising</span>
                    <span className="text-[11px] text-slate-500">45 (35%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[#ffad14]" />
                  <div>
                    <span className="block font-bold text-slate-800">Defense Ready</span>
                    <span className="text-[11px] text-slate-500">32 (25%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                  <div>
                    <span className="block font-bold text-slate-800">Archived</span>
                    <span className="text-[11px] text-slate-500">23 (18%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Level Progress Rows */}
            <div className="mt-8 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b3553]">
                College Milestone Velocity
              </h4>
              <div className="space-y-3">
                {departmentBreakdown.map((dept) => (
                  <div key={dept.name} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{dept.name}</span>
                      <span className="text-emerald-700 font-bold">{dept.rate}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full bg-[#0b3553] ${dept.bar}`} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                      <span>{dept.active} Active Research Groups</span>
                      <span>Target Milestone: Dec 15</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Faculty Advisory Load & Defense Readiness */}
          <div className="flex flex-col gap-6">
            {/* Faculty Capacity Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b3553]/10 text-[#0b3553]">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0b3553]">Faculty Advisory Balance</h4>
                    <p className="text-[11px] text-slate-500">Institutional workload protection</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  Balanced
                </span>
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800">Assigned Faculty Mentors</span>
                    <p className="text-[11px] text-slate-500">Max 5 research groups / adviser cap</p>
                  </div>
                  <span className="font-mono font-bold text-[#0b3553] text-sm">38 Professors</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800">Average Groups per Adviser</span>
                    <p className="text-[11px] text-slate-500">Below policy exhaustion threshold</p>
                  </div>
                  <span className="font-mono font-bold text-[#0b3553] text-sm">3.3 Groups</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800">Consultation Compliance</span>
                    <p className="text-[11px] text-slate-500">Mandatory bi-weekly check-ins met</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 text-sm">97.8%</span>
                </div>
              </div>
            </div>

            {/* Defense Examination Quorum Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffad14]/20 text-[#b8860b]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0b3553]">Examination Compliance</h4>
                  <p className="text-[11px] text-slate-500">Defense integrity & quorum verification</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>3-member faculty panel required for oral defenses</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Standardized rubric criteria locked before scoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Automated consensus & grade compilation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
