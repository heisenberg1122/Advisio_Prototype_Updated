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
    <Card className="flex min-h-64 flex-col rounded-2xl border-0 bg-slate-50/70 shadow-none dark:bg-white/[0.04]">
      <CardTitle icon="ti-clock" className="mb-4 text-base">
        Next consultation
      </CardTitle>
      {consultation ? (
        <>
          <div className="mb-1 text-lg font-bold text-[#0B3A53] dark:text-white">{consultation.date}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {consultation.timeRange} with {consultation.adviser}
          </div>
          <div className="mt-4">
            <Tag variant={statusVariant[consultation.status]}>
              {consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1)}
            </Tag>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
            <i className="ti ti-video-off text-2xl" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-[#0B3A53] dark:text-white">No upcoming consultations.</p>
        </div>
      )}
    </Card>
  );
}
