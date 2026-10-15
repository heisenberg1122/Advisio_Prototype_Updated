import { Card, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import type { Consultation } from "@/types/student";

interface ConsultationHistoryListProps {
  history: Consultation[];
}

export function ConsultationHistoryList({ history }: ConsultationHistoryListProps) {
  return (
    <Card>
      <CardTitle icon="ti-history" className="mb-4">
        Consultation history
      </CardTitle>

      {history.length === 0 ? (
        <div className="py-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">No past consultations yet.</div>
      ) : (
        history.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-[10px] py-2",
              i < history.length - 1 && "border-b border-[var(--color-border-tertiary)]"
            )}
          >
            <div
              className="w-[30px] h-[30px] rounded-[var(--border-radius-md)] flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--color-background-secondary)",
                color: "var(--color-text-success)",
              }}
              aria-hidden="true"
            >
              <i className="ti ti-check text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--color-text-primary)] truncate">{c.title}</div>
              <div className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                {c.date} · {c.duration} · {c.adviser}
              </div>
            </div>
            <Tag variant="success">Done</Tag>
          </div>
        ))
      )}
    </Card>
  );
}
