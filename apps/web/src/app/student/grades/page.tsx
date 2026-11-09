"use client";

import { useGrades } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { GradesSkeleton } from "@/components/grading/GradesSkeleton";
import { ConsolidatedEvaluations } from "@/components/professor/ConsolidatedEvaluations";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "@/components/ui/PageContainer";
import { withProjectContext } from "@/lib/active-project";
import ClassRecordWorkspace from "@/components/grading/ClassRecordWorkspace";
import "@/components/grading/class-record.css";

export default function GradesPage() {
  const [tab, setTab] = useState("class");
  const { user } = useAuth();
  const seal = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const switcher = (
    <div className="cr-switch" role="group" aria-label="Grade records">
      <button
        type="button"
        aria-pressed={tab === "class"}
        data-guide="grades-class"
        onClick={() => setTab("class")}
      >
        Class grades
      </button>
      <button
        type="button"
        aria-pressed={tab === "defense"}
        data-guide="grades-defense"
        onClick={() => setTab("defense")}
      >
        Defense grades
      </button>
    </div>
  );
  return (
    <div className="min-w-0">
      {tab === "class" ? (
        <ClassRecordWorkspace student switcher={switcher} />
      ) : (
        <PageContainer maxWidth="full" className="class-record min-w-0">
          <header className="cr-student-hero">
            {seal && <img className="cr-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
            <div className="cr-hero-main">
              <p className="cr-eyebrow">Your academic record</p>
              <h1>My Grades</h1>
              <p className="cr-hero-note">Defense results appear once your panel’s evaluation is released.</p>
            </div>
            <div className="cr-hero-actions">{switcher}</div>
          </header>
          <DefenseGrades />
        </PageContainer>
      )}
    </div>
  );
}

function DefenseGrades() {
  const { data: grades, isPending, error, projectId } = useGrades();

  if (isPending) return <GradesSkeleton />;
  if (error)
    return (
      <p data-guide="defense-grade-state" role="alert" className="p-6 text-red-700">
        Unable to load grades. Please try again.
      </p>
    );
  if (!projectId)
    return (
      <p data-guide="defense-grade-state" className="p-6">
        Select or register a research project to view its grades.
      </p>
    );
  if (!grades) return <p data-guide="defense-grade-state" className="p-6">No defense grades are available for this project.</p>;

  const isReleased = grades.status === "released";
  const structuredSessionId = (grades as any).structuredSessionId;
  if (structuredSessionId)
    return (
      <div data-guide="defense-grade-state">
        <ConsolidatedEvaluations sessionId={structuredSessionId} student />
      </div>
    );

  const scored = grades.panelistScores.filter((panelist) => panelist.score !== null);
  if (!isReleased || !grades.finalGrade)
    return (
      <section className="cr-panel dg-card" data-guide="defense-grade-state" aria-labelledby="dg-pending-title">
        <div className="dg-pending-head">
          <span className="dg-icon" aria-hidden="true"><i className="ti ti-lock" /></span>
          <div>
            <h2 id="dg-pending-title">Defense grades aren’t released yet</h2>
            <p>They appear here after your defense, once the panel finishes deliberating and the grades are released.</p>
          </div>
        </div>
        <div className="dg-placeholders" aria-hidden="true">
          <div><span>Panel average</span><strong>—</strong></div>
          <div><span>Each panelist’s score</span><small>Listed with their remarks once released</small></div>
        </div>
        <div className="dg-foot">
          <span>Not defended yet? Check your readiness first.</span>
          <Link to={withProjectContext("/student/defense", projectId)}>Open Defense readiness <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    );

  return (
    <section className="cr-panel dg-card" data-guide="defense-grade-state" aria-labelledby="dg-average-title">
      <div className="dg-summary">
        <div>
          <h2 id="dg-average-title">Panel average</h2>
          <strong>{grades.finalGrade}</strong>
          <small>{scored.length} {scored.length === 1 ? "panelist" : "panelists"} scored</small>
        </div>
        <p>Your final defense grade is the average of the panel’s released scores.</p>
      </div>
      <ul className="dg-panelists" aria-label="Panelist scores">
        {grades.panelistScores.map((panelist) => {
          const pct = panelist.score !== null && panelist.maxScore ? Math.min(100, (panelist.score / panelist.maxScore) * 100) : null;
          const initials = panelist.panelistName.replace(/^(dr|engr|prof|mr|ms|mrs)\.?\s+/i, "").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
          return (
            <li key={panelist.id}>
              <span className="dg-avatar" aria-hidden="true">{initials}</span>
              <span className="dg-who">
                <span className="dg-name">{panelist.panelistName}</span>
                <span className="dg-remarks">{panelist.remarks || "No remarks"}</span>
              </span>
              <span className="dg-bar" aria-hidden="true">{pct !== null && <span style={{ width: `${pct}%` }} />}</span>
              <span className="dg-score">{panelist.score !== null ? `${panelist.score}/${panelist.maxScore}` : "Not scored"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
