import { FileText, MessageSquare, Calendar, CheckCircle2 } from "lucide-react";

export function ProblemSolution() {
  return (
    <section id="solution" className="landing-section landing-solution">
      <div className="landing-container">
        <div className="landing-solution-layout">
          <div>
            <p className="landing-eyebrow">A more considered way to work</p>
            <h2>
              One research record.
              <br />
              Everyone on the same page.
            </h2>
            <p>
              Move from scattered files and conversations to a shared workspace
              that keeps the context with the work.
            </p>
            <ul className="landing-solution-benefits">
              <li>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>A clear history of drafts and review decisions</span>
              </li>
              <li>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>Feedback connected to the right submission</span>
              </li>
              <li>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>Visible milestones and accountable handoffs</span>
              </li>
            </ul>
          </div>
          <div className="landing-record-card">
            <p className="landing-sample-label">
              Illustrative project record · Sample data
            </p>
            <h3>Smart City Autonomous Grid</h3>
            <p className="landing-record-subtitle">
              Research team · Computing & informatics
            </p>
            <div className="landing-record-row">
              <FileText size={18} aria-hidden="true" />
              <div>
                <strong>Manuscript</strong>
                <p>Chapter 3 · Version 1.2</p>
              </div>
              <span>In review</span>
            </div>
            <div className="landing-record-row">
              <MessageSquare size={18} aria-hidden="true" />
              <div>
                <strong>Adviser feedback</strong>
                <p>Three notes linked to this draft</p>
              </div>
              <span>Recorded</span>
            </div>
            <div className="landing-record-row">
              <Calendar size={18} aria-hidden="true" />
              <div>
                <strong>Consultation</strong>
                <p>Oct 29 · Meeting details and notes</p>
              </div>
              <span>Scheduled</span>
            </div>
            <div className="landing-record-footer">
              <span>One project. A connected history.</span>
              <CheckCircle2 size={16} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
