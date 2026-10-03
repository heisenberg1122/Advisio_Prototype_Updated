"use client";

import { useGrades } from "@/hooks/use-student";
import { FinalGradeCard } from "@/components/grading/FinalGradeCard";
import { PanelistScoresCard } from "@/components/grading/PanelistScoresCard";
import { GradesSkeleton } from "@/components/grading/GradesSkeleton";

export default function GradesPage() {
  const { data: grades, isPending } = useGrades();

  if (isPending) return <GradesSkeleton />;
  if (!grades) return null;

  const isReleased = grades.status === "released";

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <FinalGradeCard finalGrade={grades.finalGrade} isReleased={isReleased} />
        </div>
        <div className="md:col-span-2">
          <PanelistScoresCard scores={grades.panelistScores} isReleased={isReleased} />
        </div>
      </div>
    </div>
  );
}
