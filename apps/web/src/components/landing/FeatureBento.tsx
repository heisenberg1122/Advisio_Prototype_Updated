import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Calendar,
  Award,
  BarChart3,
  Building2,
  ArrowUpRight,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Documents with a history",
    description:
      "Keep drafts, submission versions, and document integrity records together.",
    detail: "Document management",
  },
  {
    icon: MessageSquare,
    title: "Feedback in context",
    description:
      "Link adviser annotations and revision requests to the manuscript being reviewed.",
    detail: "Adviser mentorship",
  },
  {
    icon: Calendar,
    title: "Time for better guidance",
    description:
      "Coordinate consultations, meeting details, and notes. Google Meet is available when configured.",
    detail: "Consultations",
  },
  {
    icon: Award,
    title: "A prepared defense",
    description:
      "Share defense packets with assigned panelists and record rubric scores and recommendations.",
    detail: "Panel evaluation",
  },
  {
    icon: BarChart3,
    title: "A clearer institutional view",
    description:
      "Follow research progress, pending reviews, and faculty advising loads across groups.",
    detail: "Research monitoring",
  },
  {
    icon: Building2,
    title: "Approvals that stay connected",
    description:
      "Keep ethics reviews, institutional clearances, and official copies within the research record.",
    detail: "Ethics & archiving",
  },
];

export function FeatureBento() {
  return (
    <section id="features" className="landing-section landing-features">
      <div className="landing-container">
        <div className="landing-section-heading landing-heading-split">
          <div>
            <p className="landing-eyebrow">The research essentials</p>
            <h2>
              Less administration.
              <br />
              More room for research.
            </h2>
          </div>
          <p>
            A considered set of tools for the people, documents, and decisions
            that move academic work forward.
          </p>
        </div>
        <div className="landing-feature-grid">
          <article
            className="landing-feature-card landing-feature-main"
            data-reveal
          >
            <LayoutDashboard size={24} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <p className="landing-eyebrow">One shared foundation</p>
              <h3>Your research, in one place.</h3>
              <p>
                Bring your group, milestones, and deliverables into a workspace
                everyone can follow.
              </p>
            </div>
            <div
              className="landing-feature-progress"
              aria-label="Sample milestone progress: 3 of 5 complete"
            >
              <div>
                <span>Milestone progress</span>
                <span>Sample data · 3 of 5</span>
              </div>
              <div className="landing-progress-track">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={i < 3 ? "is-complete" : ""} />
                ))}
              </div>
              <div>
                <span>Proposal</span>
                <span>Final manuscript</span>
              </div>
            </div>
          </article>
          {features.map(({ icon: Icon, title, description, detail }) => (
            <article key={title} className="landing-feature-card" data-reveal>
              <div className="landing-feature-meta">
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>{detail}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <a className="landing-text-link" href="#workflow">
          Follow the research journey{" "}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
