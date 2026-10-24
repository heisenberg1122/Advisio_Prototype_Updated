import { Card, CardTitle } from "@/components/ui/Card";
import type { PanelistScore } from "@/types/student";

interface PanelistScoresCardProps {
  scores: PanelistScore[];
  isReleased: boolean;
}

export function PanelistScoresCard({ scores, isReleased }: PanelistScoresCardProps) {
  return (
    <Card>
      <CardTitle icon="ti-star" className="mb-4">
        Panelist scores
      </CardTitle>

      {isReleased && scores.length > 0 ? (
        <div className="space-y-3">
          {scores.map((ps) => (
            <div
              key={ps.id}
              className="flex items-center justify-between py-2 border-b border-[var(--color-border-tertiary)] last:border-none"
            >
              <div>
                <div className="text-[13px]">{ps.panelistName}</div>
                {ps.remarks && (
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {ps.remarks}
                  </div>
                )}
              </div>
              <div className="text-[15px] font-medium text-[var(--color-text-success)]">
                {ps.score} / {ps.maxScore}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <i
            className="ti ti-lock text-2xl block mb-2"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-hidden="true"
          />
          Scores will appear here after your defense session
        </div>
      )}
    </Card>
  );
}
