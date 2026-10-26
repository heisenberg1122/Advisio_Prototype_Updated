import React, { useState } from "react";
import {
  GraduationCap,
  Users,
  Award,
  BookOpen,
  Scale,
  Settings,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

type RoleProfile = {
  id: string;
  name: string;
  badge: string;
  summary: string;
  highlights: string[];
  mockStats: { label: string; value: string }[];
  mockFeed: { title: string; subtitle: string; tag: string }[];
  icon: React.ComponentType<{ className?: string }>;
};

const ROLES: RoleProfile[] = [
  {
    id: "researcher",
    name: "Researchers",
    badge: "Undergraduate & Graduate",
    summary: "A focused thesis cockpit for drafting manuscripts, tracking milestone velocity, scheduling adviser consultations, and preparing defense packets.",
    highlights: [
      "Real-time milestone progress bar and chapter deliverables checklist",
      "Inline margin annotations with feedback resolution threads",
      "One-click Google Meet consultation scheduling and attendance verification",
    ],
    mockStats: [
      { label: "Overall Progress", value: "72%" },
      { label: "Current Chapter", value: "Chapter 3" },
      { label: "Pending Reviews", value: "1 Active" },
      { label: "Next Meeting", value: "Thu 2:00 PM" },
    ],
    mockFeed: [
      { title: "Chapter 3 Methodology v1.2", subtitle: "Adviser requested revisions on sampling procedure", tag: "In Review" },
      { title: "Chapter 2 Literature Review", subtitle: "Endorsed with minor stylistic notes", tag: "Approved" },
      { title: "Consultation Scheduled", subtitle: "Oct 29 · Google Meet link confirmed", tag: "Confirmed" },
    ],
    icon: GraduationCap,
  },
  {
    id: "adviser",
    name: "Advisers",
    badge: "Faculty Mentorship",
    summary: "A high-efficiency advising inbox for supervising student cohorts, managing workload caps, conducting consultations, and issuing digital endorsement stamps.",
    highlights: [
      "Clear advisee group capacity quotas to prevent faculty overload",
      "Full document viewer with paragraph-level annotations and revision stamps",
      "Automated consultation logging with recorded notes and minutes",
    ],
    mockStats: [
      { label: "Active Advisees", value: "6 Groups" },
      { label: "Capacity Limit", value: "6 / 8 Slots" },
      { label: "Review Inbox", value: "3 Pending" },
      { label: "Consultations", value: "4 This Week" },
    ],
    mockFeed: [
      { title: "Group 4 (BSCS): Autonomous Grid", subtitle: "New draft uploaded for Chapter 3 methodology review", tag: "Needs Review" },
      { title: "Group 2 (BSIT): Tele-health Portal", subtitle: "Revision matrix confirmed and endorsed for pre-oral", tag: "Endorsed" },
      { title: "Consultation Request", subtitle: "Group 7 requested 30-min slot for Friday", tag: "Pending" },
    ],
    icon: Users,
  },
  {
    id: "panelist",
    name: "Panelists",
    badge: "Examination Committee",
    summary: "A rigorous defense evaluation workspace for reviewing compiled defense packets, scoring presentations live, and recording official recommendations.",
    highlights: [
      "Access pre-compiled defense packets containing verified drafts and adviser sign-offs",
      "Live multi-criteria institutional grading rubrics with automatic tallying",
      "Formal recommendation locking (Passed, Minor Revision, Major Revision, Re-defense)",
    ],
    mockStats: [
      { label: "Assigned Defenses", value: "4 Sessions" },
      { label: "Packets Reviewed", value: "4 of 4" },
      { label: "Completed Rubrics", value: "3 Locked" },
      { label: "Upcoming Session", value: "Fri 9:00 AM" },
    ],
    mockFeed: [
      { title: "Oral Defense: Micro-Grid Architecture", subtitle: "Candidate presentation scheduled for Room 304 / Online", tag: "Ready" },
      { title: "Evaluation Sheet: Tele-Health Platform", subtitle: "Score 92.4 locked with minor revision condition", tag: "Submitted" },
      { title: "Review Packet Dispatched", subtitle: "Group 12 defense manuscript ready for preview", tag: "New Packet" },
    ],
    icon: Award,
  },
  {
    id: "professor",
    name: "Professors",
    badge: "Course & Capstone Instructors",
    summary: "Curriculum oversight for research methodology and capstone classes, tracking milestone submissions, deadlines, and similarity reports across sections.",
    highlights: [
      "Section-wide milestone submission status and deadline compliance tracker",
      "Integrated document repository for classroom guidelines and rubric distribution",
      "Direct communication channel to coordinate with appointed advisers",
    ],
    mockStats: [
      { label: "Class Sections", value: "2 Sections" },
      { label: "Total Students", value: "64 Enrolled" },
      { label: "Submission Rate", value: "96.8%" },
      { label: "Milestones Due", value: "Nov 06" },
    ],
    mockFeed: [
      { title: "Section CS-4A: Proposal Submissions", subtitle: "16 of 16 groups submitted initial problem statements", tag: "On Time" },
      { title: "Class Announcement", subtitle: "Updated formatting guidelines uploaded to course files", tag: "Broadcast" },
      { title: "Similarity Check", subtitle: "All Chapter 1 submissions checked for originality", tag: "Clean" },
    ],
    icon: BookOpen,
  },
  {
    id: "coordinator",
    name: "Research Coordinators",
    badge: "Department Leadership",
    summary: "Departmental command center for matching adviser specializations, organizing oral defense schedules, and balancing faculty committee loads.",
    highlights: [
      "Faculty capacity balancing tool based on academic rank and specializations",
      "Automated defense schedule conflict detector across panels and venues",
      "Department-level milestone velocity and completion metrics",
    ],
    mockStats: [
      { label: "Department Groups", value: "42 Groups" },
      { label: "Faculty Advisers", value: "14 Active" },
      { label: "Defense Slots", value: "18 Scheduled" },
      { label: "Completion Rate", value: "88%" },
    ],
    mockFeed: [
      { title: "Oral Defense Schedule Grid", subtitle: "Generated conflict-free panel assignments for next week", tag: "Published" },
      { title: "Adviser Allocation Notice", subtitle: "Assigned 3 new thesis groups in AI track to Dr. Vance", tag: "Assigned" },
      { title: "Midterm Progress Audit", subtitle: "4 groups flagged as needing methodology acceleration", tag: "Attention" },
    ],
    icon: Scale,
  },
  {
    id: "admin",
    name: "Administrators",
    badge: "System & Dean Management",
    summary: "Institutional control over university research policies, Google storage quotas, audit trails, and archival copy governance.",
    highlights: [
      "Role-based access provisioning and institutional email domain verification",
      "Google Workspace storage integration and cryptographic archive integrity ledger",
      "Comprehensive compliance reports and institutional accreditation data exports",
    ],
    mockStats: [
      { label: "Active Users", value: "1,240" },
      { label: "Archived Theses", value: "384" },
      { label: "System Uptime", value: "99.98%" },
      { label: "Storage Used", value: "42.8 GB" },
    ],
    mockFeed: [
      { title: "Official Copy Cryptographic Seal", subtitle: "Archived 12 final approved dissertations to institutional repo", tag: "Sealed" },
      { title: "Google Drive Quota Status", subtitle: "Departmental cloud directories connected and healthy", tag: "Connected" },
      { title: "Annual Audit Export", subtitle: "Accreditation evidence file generated for university board", tag: "Complete" },
    ],
    icon: Settings,
  },
];

export function RoleExperience() {
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const activeRole = ROLES[selectedRoleIndex];
  const ActiveIcon = activeRole.icon;

  return (
    <section id="roles" className="py-20 lg:py-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0b3553]">
            Adaptive Experience
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-[40px] leading-tight">
            One platform. Designed for every research stakeholder.
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Advisio recognizes that a student, a faculty adviser, an examination chair, and a dean have vastly different needs. Each role gets a purpose-built workspace.
          </p>
        </div>

        {/* Interactive Role Selector Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {ROLES.map((role, idx) => {
            const Icon = role.icon;
            const isSelected = selectedRoleIndex === idx;
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleIndex(idx)}
                aria-pressed={isSelected}
                className={`flex items-center gap-2 rounded-xl px-4.5 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0b3553] text-white shadow-md shadow-[#0b3553]/15"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{role.name}</span>
              </button>
            );
          })}
        </div>

        {/* Role Preview Card Container */}
        <div className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.3fr] gap-10 items-center">
            {/* Left: Role Info & Value Proposition */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0b3553]/10 px-3 py-1 text-xs font-bold text-[#0b3553]">
                <ActiveIcon className="h-3.5 w-3.5" />
                <span>{activeRole.badge} · Sample Workspace</span>
              </div>

              <h3 className="mt-3 text-2xl sm:text-3xl font-black text-[#0b3553]">
                {activeRole.name} Workspace
              </h3>

              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                {activeRole.summary}
              </p>

              {/* Bullet Features */}
              <div className="mt-6 space-y-3">
                {activeRole.highlights.map((feat) => (
                  <div key={feat} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0b3553] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#124569] transition-colors"
                >
                  <span>Sign In to {activeRole.name} Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right: Mock Dashboard UI for Selected Role */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0b3553] text-white">
                    <ActiveIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-[#0b3553]">
                      {activeRole.name} Portal Dashboard
                    </strong>
                    <span className="block text-[10px] text-slate-400">
                      Live Verification View
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Authorized
                </span>
              </div>

              {/* 4 Mock Metrics for this Role */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {activeRole.mockStats.map((st) => (
                  <div key={st.label} className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-center">
                    <span className="block font-mono font-bold text-sm text-[#0b3553] tabular-nums">
                      {st.value}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-medium truncate">
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Activity / Action Feed for this Role */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Active Priority Queue
                </span>
                {activeRole.mockFeed.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <strong className="block text-xs font-bold text-slate-800 truncate">
                        {item.title}
                      </strong>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs">
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
