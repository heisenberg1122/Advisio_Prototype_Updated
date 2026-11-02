"use client";

import { useGrades } from "@/hooks/use-student";
import { FinalGradeCard } from "@/components/grading/FinalGradeCard";
import { PanelistScoresCard } from "@/components/grading/PanelistScoresCard";
import { GradesSkeleton } from "@/components/grading/GradesSkeleton";
import { ConsolidatedEvaluations } from "@/components/professor/ConsolidatedEvaluations";
import { useState } from "react";
import ClassRecordWorkspace from "@/components/grading/ClassRecordWorkspace";

export default function GradesPage() {
  const [tab, setTab] = useState("class");
  return (
    <div className="min-w-0">
      <div
        className="flex flex-wrap gap-2 px-4 pt-5 sm:px-6 lg:px-8"
        role="group"
        aria-label="Grade records"
      >
        <button
          aria-pressed={tab === "class"}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] aria-pressed:bg-[var(--color-primary)] aria-pressed:text-white"
          onClick={() => setTab("class")}
        >
          Class Grades
        </button>
        <button
          aria-pressed={tab === "defense"}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] aria-pressed:bg-[var(--color-primary)] aria-pressed:text-white"
          onClick={() => setTab("defense")}
        >
          Defense Grades
        </button>
      </div>
      {tab === "class" ? <ClassRecordWorkspace student /> : <DefenseGrades />}
    </div>
  );
}

function DefenseGrades() {
  const { data: grades, isPending, error, projectId } = useGrades();

  if (isPending) return <GradesSkeleton />;
  if (error)
    return (
      <p role="alert" className="p-6 text-red-700">
        Unable to load grades. Please try again.
      </p>
    );
  if (!projectId)
    return (
      <p className="p-6">
        Select or register a research project to view its grades.
      </p>
    );
  if (!grades) return null;

  const isReleased = grades.status === "released";
  const structuredSessionId = (grades as any).structuredSessionId;
  if (structuredSessionId)
    return (
      <div className="mx-auto max-w-[1360px] p-4 sm:p-6">
        <ConsolidatedEvaluations sessionId={structuredSessionId} student />
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <FinalGradeCard
            finalGrade={grades.finalGrade}
            isReleased={isReleased}
          />
        </div>
        <div className="md:col-span-2">
          <PanelistScoresCard
            scores={grades.panelistScores}
            isReleased={isReleased}
          />
        </div>
      </div>
    </div>
  );
}
