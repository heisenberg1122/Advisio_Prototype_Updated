import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
const roles = [
  {
    name: "Researcher",
    title: "Your research. A clearer way forward.",
    copy: "Track progress, manage documents, and act on adviser feedback.",
    workspace: "My research",
    Icon: FileText,
    rows: [
      ["Chapter 3 · Methodology", "Needs revision"],
      ["Adviser consultation", "Oct 29 · 2:00 PM"],
      ["Chapter 2 · Literature review", "Approved"],
    ],
  },
  {
    name: "Adviser",
    title: "More context for every conversation.",
    copy: "Review submissions, annotate documents, and guide research progress.",
    workspace: "Advising workspace",
    Icon: MessageSquare,
    rows: [
      ["Methodology · v1.3", "Ready for review"],
      ["Section 3.2 annotation", "Feedback attached"],
      ["Research consultation", "Confirmed"],
    ],
  },
  {
    name: "Faculty & Panel",
    title: "A shared view. An informed decision.",
    copy: "Review assigned research, evaluate presentations, and record decisions.",
    workspace: "Evaluation workspace",
    Icon: Users,
    rows: [
      ["Research presentation", "Assigned to you"],
      ["Evaluation rubric", "In progress"],
      ["Panel decision", "For recording"],
    ],
  },
  {
    name: "Research Office",
    title: "See the process, with the details in reach.",
    copy: "Monitor workflows, track institutional requirements, and maintain research records.",
    workspace: "Institutional workspace",
    Icon: Check,
    rows: [
      ["Institutional review", "Under review"],
      ["Workflow requirements", "Configured"],
      ["Final research record", "Retained"],
    ],
  },
];
export function RoleExperience() {
  const [active, setActive] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const role = roles[active];
  const Icon = role.Icon;
  const select = (index: number) => {
    setActive(index);
    (tabsRef.current?.children[index] as HTMLButtonElement)?.focus();
  };
  return (
    <section id="roles" className="lp-roles lp-section" data-scene>
      <div className="lp-container">
        <div className="lp-roles-heading">
          <p className="lp-eyebrow">
            03 / Made for the people behind the research
          </p>
          <h2>
            Same research.
            <br />
            Different responsibilities.
            <br />
            <span>One workspace.</span>
          </h2>
        </div>
        <div
          className="lp-role-tabs"
          ref={tabsRef}
          role="tablist"
          aria-label="Explore by role"
          onKeyDown={(event) => {
            let next = active;
            if (event.key === "ArrowRight") next = (active + 1) % roles.length;
            else if (event.key === "ArrowLeft")
              next = (active + roles.length - 1) % roles.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = roles.length - 1;
            else return;
            event.preventDefault();
            select(next);
          }}
        >
          {roles.map((item, index) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              id={`role-tab-${index}`}
              aria-selected={active === index}
              aria-controls="role-panel"
              tabIndex={active === index ? 0 : -1}
              onClick={() => setActive(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div
          id="role-panel"
          role="tabpanel"
          aria-labelledby={`role-tab-${active}`}
          tabIndex={0}
          className="lp-role-panel"
        >
          <div className="lp-role-description" key={role.name}>
            <p className="lp-micro">For the {role.name.toLowerCase()}</p>
            <h3>{role.title}</h3>
            <p>{role.copy}</p>
            <Link to="/login" className="lp-text-link">
              Find your workspace <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="lp-role-preview" key={active}>
            <div className="lp-row">
              <span className="lp-role-preview-icon">
                <Icon size={21} />
              </span>
              <span className="lp-sample">Illustrative workspace</span>
            </div>
            <h4>{role.workspace}</h4>
            <div className="lp-role-research">
              <FileText size={16} />
              <span>Advisio research project</span>
            </div>
            <div className="lp-role-rows">
              {role.rows.map(([title, status]) => (
                <div key={title}>
                  <span>{title}</span>
                  <span className={status === "Approved" ? "is-approved" : ""}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
            <div className="lp-role-footnote">
              <span className="lp-status-dot" /> Connected to the same research
              record
            </div>
          </div>
        </div>
        <p className="lp-role-note">
          Workspace access and available actions follow your institution&apos;s
          assigned roles.
        </p>
      </div>
    </section>
  );
}
