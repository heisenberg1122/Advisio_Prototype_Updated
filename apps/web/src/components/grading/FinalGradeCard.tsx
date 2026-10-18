import { Card } from "@/components/ui/Card";

interface FinalGradeCardProps {
  finalGrade: string | null;
  isReleased: boolean;
}

export function FinalGradeCard({ finalGrade, isReleased }: FinalGradeCardProps) {
  return (
    <Card className="mb-4">
      <div className="text-center py-6">
        <div className="text-[13px] text-[var(--color-text-secondary)] mb-1">
          Released panel average
        </div>
        {isReleased && finalGrade ? (
          <div
            className="text-[48px] font-medium"
            style={{ color: "var(--color-text-success)" }}
          >
            {finalGrade}
          </div>
        ) : (
          <>
            <div
              className="text-[40px] font-medium"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              —
            </div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">
              Available after defense
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
