import { Card, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { Consultation, ConsultationStatus } from "@/types/student";

const statusVariant: Record<ConsultationStatus, "success" | "warn" | "info" | "neutral"> = {
  confirmed: "info",
  pending:   "warn",
  done:      "success",
  cancelled: "neutral",
};

interface NextConsultationCardProps {
  consultation: Consultation | null;
}

export function NextConsultationCard({ consultation }: NextConsultationCardProps) {
  return (
    <Card className="flex min-h-[220px] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
      <CardTitle icon="ti-clock" className="mb-3 text-lg">
        Next consultation
      </CardTitle>
      {consultation ? (
        <>
          <div className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">{consultation.date}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {consultation.timeRange} with {consultation.adviser}
          </div>
          <div className="mt-3">
            <Tag variant={statusVariant[consultation.status]}>
              {consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1)}
            </Tag>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center py-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <i className="ti ti-video-off text-xl" aria-hidden="true" />
          </span>
          <p className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">No upcoming consultations</p>
          <p className="mt-1 text-base text-[var(--color-text-secondary)] max-w-xs">Use the booking form to schedule a session with your faculty adviser.</p>
        </div>
      )}
    </Card>
  );
}
