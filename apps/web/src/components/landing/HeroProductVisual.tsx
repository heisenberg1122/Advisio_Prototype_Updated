import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Calendar,
  MessageSquare,
  Award,
  Clock,
  CheckCircle2,
  Bell,
  ChevronRight,
} from "lucide-react";
import { handleLandingTabKey } from "./landing-tabs";

const TABS = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "My Research", icon: BookOpen },
  { name: "Documents", icon: FileText },
  { name: "Consultations", icon: Clock },
  { name: "Calendar", icon: Calendar },
  { name: "Feedback", icon: MessageSquare },
  { name: "Evaluations", icon: Award },
];
const PANELS: Record<
  string,
  { lead: string; rows: [string, string, string][] }
> = {
  "My Research": {
    lead: "A shared record of your group's next steps.",
    rows: [
      ["Title proposal", "Selected research title recorded", "Approved"],
      [
        "Chapter 3 · Methodology",
        "Address adviser feedback before resubmitting",
        "In progress",
      ],
      [
        "Defense preparation",
        "Follow the configured milestone requirements",
        "Upcoming",
      ],
    ],
  },
  Documents: {
    lead: "Every submission has a version you can return to.",
    rows: [
      ["Chapter 3 · Methodology", "Version 1.2 · Oct 26, 2026", "In review"],
      [
        "Chapter 2 · Literature review",
        "Version 2.0 · Oct 22, 2026",
        "Approved",
      ],
      ["Research instruments", "Version 1.0 · Oct 20, 2026", "Submitted"],
    ],
  },
  Consultations: {
    lead: "Keep the conversation connected to your research.",
    rows: [
      [
        "Methodology consultation",
        "Oct 29 · 2:00 PM · Google Meet",
        "Scheduled",
      ],
      ["Literature review follow-up", "Oct 22 · Notes recorded", "Completed"],
      ["Proposal discussion", "Oct 15 · Notes recorded", "Completed"],
    ],
  },
  Calendar: {
    lead: "Consultations and research deadlines in one view.",
    rows: [
      ["Adviser consultation", "Thursday, October 29 · 2:00 PM", "Meeting"],
      ["Document review", "Monday, November 2", "Deadline"],
      ["Research presentation", "Friday, November 13", "Upcoming"],
    ],
  },
  Feedback: {
    lead: "Review comments alongside the work they refer to.",
    rows: [
      [
        "Clarify the sampling procedure",
        "Chapter 3 · Dr. Evelyn Vance",
        "Open",
      ],
      ["Explain sample size selection", "Chapter 3 · Dr. Evelyn Vance", "Open"],
      [
        "Refine the literature synthesis",
        "Chapter 2 · Response recorded",
        "Resolved",
      ],
    ],
  },
  Evaluations: {
    lead: "Keep assigned evaluations and recommendations in view.",
    rows: [
      ["Proposal evaluation", "Faculty recommendation recorded", "Completed"],
      [
        "Methodology review",
        "Awaiting review of the next submission",
        "Pending",
      ],
      [
        "Oral defense evaluation",
        "Available after defense scheduling",
        "Upcoming",
      ],
    ],
  },
};

export function HeroProductVisual() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  return (
    <div className="landing-product">
      <div className="landing-browser">
        <div className="landing-browser-bar">
          <div className="landing-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>
            Interactive preview <span aria-hidden="true">/</span>{" "}
            <strong>Sample data</strong>
          </span>
          <span className="landing-browser-status">
            <span />
            Advisio workspace
          </span>
        </div>
        <div className="landing-dashboard">
          <aside className="landing-preview-sidebar">
            <div className="landing-preview-brand">
              <img src="/ao-logo.png" alt="" width="32" height="32" />
              <div>
                <strong>ADVISIO</strong>
                <span>Researcher workspace</span>
              </div>
            </div>
            <div
              role="tablist"
              aria-label="Product preview"
              aria-orientation="vertical"
              onKeyDown={handleLandingTabKey}
            >
              {TABS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  id={`preview-tab-${name.replace(/ /g, "-")}`}
                  aria-selected={activeTab === name}
                  aria-controls={`preview-panel-${name.replace(/ /g, "-")}`}
                  tabIndex={activeTab === name ? 0 : -1}
                  onClick={() => setActiveTab(name)}
                >
                  <Icon size={16} aria-hidden="true" />
                  {name}
                </button>
              ))}
            </div>
            <div className="landing-preview-user">
              <span>NS</span>
              <div>
                <strong>Nicole Santos</strong>
                <small>Lead researcher · Sample</small>
              </div>
            </div>
          </aside>
          <div className="landing-dashboard-main">
            <div className="landing-preview-topbar">
              <div>
                <p className="landing-sample-label">Research workspace</p>
                <h2>Good morning, Nicole.</h2>
              </div>
              <Bell size={18} aria-hidden="true" />
            </div>
            <label className="landing-preview-mobile-nav">
              Explore the sample
              <select
                value={activeTab}
                onChange={(event) => setActiveTab(event.target.value)}
              >
                {TABS.map((tab) => (
                  <option key={tab.name}>{tab.name}</option>
                ))}
              </select>
            </label>
            <div className="landing-panel-stack">
              <div
                id="preview-panel-Dashboard"
                role="tabpanel"
                tabIndex={0}
                aria-label="Dashboard sample"
                aria-hidden={activeTab !== "Dashboard"}
                inert={activeTab !== "Dashboard"}
                className={`landing-stable-panel ${activeTab === "Dashboard" ? "is-active" : ""}`}
              >
                <article className="landing-project-card">
                  <div className="landing-project-heading">
                    <span className="landing-eyebrow">IT capstone · 2026</span>
                    <span className="landing-sample-label">On schedule</span>
                  </div>
                  <h3>
                    Advisio: A Research Advising
                    <br className="hidden sm:block" /> and Management Platform
                  </h3>
                  <div className="landing-project-progress">
                    <span>Chapter 3 · Methodology</span>
                    <strong>72%</strong>
                  </div>
                  <div className="landing-project-track">
                    <span />
                  </div>
                  <div className="landing-project-meta">
                    <div>
                      <small>Assigned adviser</small>
                      <strong>Dr. Evelyn Vance</strong>
                    </div>
                    <div>
                      <small>Next consultation</small>
                      <strong>Oct 29 · 2:00 PM</strong>
                    </div>
                  </div>
                  <div className="landing-preview-feedback">
                    <MessageSquare size={16} aria-hidden="true" />
                    <p>
                      <strong>A note from your adviser</strong>Please clarify
                      the sampling procedure before our next consultation.
                    </p>
                  </div>
                </article>
                <div className="landing-preview-upcoming">
                  <Calendar size={17} aria-hidden="true" />
                  <div>
                    <strong>Research presentation</strong>
                    <span>Friday, November 13</span>
                  </div>
                  <ChevronRight size={15} aria-hidden="true" />
                </div>
              </div>
              {Object.entries(PANELS).map(([name, panel]) => (
                <div
                  key={name}
                  id={`preview-panel-${name.replace(/ /g, "-")}`}
                  role="tabpanel"
                  tabIndex={0}
                  aria-label={`${name} sample`}
                  aria-hidden={activeTab !== name}
                  inert={activeTab !== name}
                  className={`landing-stable-panel landing-sample-panel ${activeTab === name ? "is-active" : ""}`}
                >
                  <p className="landing-eyebrow">Sample workspace</p>
                  <h3>{name}</h3>
                  <p>{panel.lead}</p>
                  <div className="landing-sample-rows">
                    {panel.rows.map(([title, sub, status]) => (
                      <div key={title}>
                        <div>
                          <strong>{title}</strong>
                          <p>{sub}</p>
                        </div>
                        <span>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="landing-floating-card landing-floating-approved">
        <CheckCircle2 size={29} aria-hidden="true" />
        <div>
          <span>Milestone approved</span>
          <strong>Chapter 2 · Literature review</strong>
        </div>
      </div>
      <div className="landing-floating-card landing-floating-feedback">
        <MessageSquare size={24} aria-hidden="true" />
        <div>
          <span>Feedback received</span>
          <strong>3 notes on your latest draft</strong>
        </div>
      </div>
    </div>
  );
}
