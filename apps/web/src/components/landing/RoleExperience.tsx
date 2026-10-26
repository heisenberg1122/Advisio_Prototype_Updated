import { useState } from "react";
import {
  GraduationCap,
  Users,
  Award,
  BookOpen,
  Scale,
  Settings,
  ArrowRight,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import { handleLandingTabKey } from "./landing-tabs";

const ROLES = [
  {
    id: "researcher",
    name: "Researchers",
    icon: GraduationCap,
    heading: "Focus on the work that matters.",
    summary:
      "A shared home for your group, manuscript drafts, adviser feedback, and upcoming milestones.",
    highlights: [
      "Follow assigned milestones and submission requirements",
      "Respond to manuscript feedback and track revisions",
      "Keep consultations and defense preparation in view",
    ],
    stats: [
      ["Overall progress", "72%"],
      ["Current stage", "Methodology"],
      ["Pending review", "1 draft"],
    ],
    feed: [
      ["Chapter 3 · Methodology", "Adviser requested revisions", "In review"],
      [
        "Chapter 2 · Literature review",
        "Feedback addressed and approved",
        "Approved",
      ],
      ["Adviser consultation", "Oct 29 · 2:00 PM", "Scheduled"],
    ],
  },
  {
    id: "adviser",
    name: "Advisers",
    icon: Users,
    heading: "Guide research with context.",
    summary:
      "Bring advisee groups, review requests, and consultation notes into one focused faculty workspace.",
    highlights: [
      "Manage requests within your advising capacity",
      "Annotate submitted drafts and record review decisions",
      "Coordinate consultations and keep meeting notes",
    ],
    stats: [
      ["Advisee groups", "6"],
      ["Pending reviews", "3"],
      ["Consultations", "4 this week"],
    ],
    feed: [
      [
        "Group 4 · Chapter 3 draft",
        "New methodology submission",
        "Needs review",
      ],
      [
        "Group 2 · Revised manuscript",
        "Revision feedback addressed",
        "Approved",
      ],
      ["Consultation request", "Group 7 · Friday afternoon", "Pending"],
    ],
  },
  {
    id: "panelist",
    name: "Panelists",
    icon: Award,
    heading: "Arrive prepared. Evaluate clearly.",
    summary:
      "Review assigned defense materials and record evaluations in a dedicated examination workspace.",
    highlights: [
      "Access the published manuscript packet for your defense",
      "Score using the configured evaluation rubric",
      "Record feedback and official recommendations",
    ],
    stats: [
      ["Assigned defenses", "4"],
      ["Packets reviewed", "4 of 4"],
      ["Evaluations", "3 submitted"],
    ],
    feed: [
      ["Oral defense · Micro-grid study", "Friday · Room 304", "Upcoming"],
      [
        "Evaluation · Tele-health study",
        "Rubric and recommendations recorded",
        "Submitted",
      ],
      ["New defense packet", "Manuscript available for review", "Published"],
    ],
  },
  {
    id: "professor",
    name: "Professors",
    icon: BookOpen,
    heading: "Give every group a clear path.",
    summary:
      "Organize course research workflows, distribute requirements, and follow submissions across your classes.",
    highlights: [
      "Define milestones, deadlines, and prerequisite approvals",
      "Share guidelines, resources, and submission requirements",
      "Review group submissions and communicate decisions",
    ],
    stats: [
      ["Class sections", "2"],
      ["Enrolled students", "64"],
      ["Next deadline", "Nov 06"],
    ],
    feed: [
      ["CS-4A · Title proposals", "16 groups submitted proposals", "Submitted"],
      [
        "Research guidelines",
        "Formatting guide shared with the class",
        "Available",
      ],
      ["Milestone review", "Chapter 1 submission awaits a decision", "Pending"],
    ],
  },
  {
    id: "coordinator",
    name: "Coordinators",
    icon: Scale,
    heading: "Keep the department moving.",
    summary:
      "Coordinate faculty assignments, defense schedules, and research progress across departmental groups.",
    highlights: [
      "Follow faculty availability and advising assignments",
      "Coordinate defense panels and schedules",
      "Review departmental milestones and pending actions",
    ],
    stats: [
      ["Research groups", "42"],
      ["Faculty advisers", "14"],
      ["Defense sessions", "18"],
    ],
    feed: [
      ["Defense schedule", "Next week's sessions published", "Scheduled"],
      ["Adviser assignment", "Three groups connected with faculty", "Assigned"],
      ["Progress review", "Four groups have pending milestones", "Follow up"],
    ],
  },
  {
    id: "admin",
    name: "Administrators",
    icon: Settings,
    heading: "Support research at every level.",
    summary:
      "Manage institutional access, connected services, activity records, and research administration.",
    highlights: [
      "Manage accounts and role-based permissions",
      "Configure connected Google services when enabled",
      "Oversee institutional records and official copies",
    ],
    stats: [
      ["Active accounts", "1,240"],
      ["Archived studies", "384"],
      ["Storage used", "42.8 GB"],
    ],
    feed: [
      ["Official manuscript copies", "12 approved copies recorded", "Archived"],
      [
        "Google Drive connection",
        "Institutional storage configured",
        "Connected",
      ],
      ["Account requests", "New faculty accounts await review", "Pending"],
    ],
  },
];

export function RoleExperience() {
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  return (
    <section id="roles" className="landing-section landing-roles">
      <div className="landing-container">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Designed around people</p>
          <h2>
            A shared purpose.
            <br />A workspace for every role.
          </h2>
          <p>
            Explore how each member of your academic community works in Advisio.
          </p>
        </div>
        <div className="landing-role-layout">
          <div
            role="tablist"
            aria-label="Academic roles"
            aria-orientation="vertical"
            className="landing-role-tabs"
            onKeyDown={handleLandingTabKey}
          >
            {ROLES.map((role, index) => {
              const Icon = role.icon;
              return (
                <button
                  type="button"
                  role="tab"
                  key={role.id}
                  id={`role-tab-${role.id}`}
                  aria-selected={selectedRoleIndex === index}
                  aria-controls={`role-panel-${role.id}`}
                  tabIndex={selectedRoleIndex === index ? 0 : -1}
                  onClick={() => setSelectedRoleIndex(index)}
                >
                  <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
                  <span>{role.name}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="landing-panel-stack">
            {ROLES.map((role, index) => {
              const Icon = role.icon;
              const active = index === selectedRoleIndex;
              return (
                <div
                  key={role.id}
                  role="tabpanel"
                  id={`role-panel-${role.id}`}
                  aria-labelledby={`role-tab-${role.id}`}
                  aria-hidden={!active}
                  inert={!active}
                  tabIndex={0}
                  className={`landing-stable-panel landing-role-panel ${active ? "is-active" : ""}`}
                >
                  <div className="landing-role-copy">
                    <p className="landing-eyebrow">{role.name}</p>
                    <h3>{role.heading}</h3>
                    <p>{role.summary}</p>
                    <ul>
                      {role.highlights.map((item) => (
                        <li key={item}>
                          <Check size={16} aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/login" className="landing-text-link">
                      Sign In to {role.name} Portal{" "}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="landing-role-preview">
                    <div className="landing-role-preview-heading">
                      <Icon size={20} aria-hidden="true" />
                      <strong>{role.name} workspace</strong>
                      <span className="landing-sample-label">Sample data</span>
                    </div>
                    <div className="landing-role-stats">
                      {role.stats.map(([label, value]) => (
                        <div key={label}>
                          <strong>{value}</strong>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="landing-sample-label">Recent activity</p>
                    <div className="landing-role-feed">
                      {role.feed.map(([title, subtitle, tag]) => (
                        <div key={title}>
                          <div>
                            <strong>{title}</strong>
                            <p>{subtitle}</p>
                          </div>
                          <span>{tag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
