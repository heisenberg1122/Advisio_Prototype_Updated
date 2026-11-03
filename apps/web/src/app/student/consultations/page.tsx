"use client";

import { useConsultations } from "@/hooks/use-student";
import { ConsultationBooking } from "@/components/consultations/ConsultationBooking";
import { useAuth } from "@/providers/auth-provider";
import { NextConsultationCard } from "@/components/consultations/NextConsultationCard";
import { ConsultationHistoryList } from "@/components/consultations/ConsultationHistoryList";
import { ConsultationSkeleton } from "@/components/consultations/ConsultationSkeleton";
import { PageContainer } from "@/components/ui/PageContainer";

export default function ConsultationsPage() {
  const { user } = useAuth();
  const { data, isPending, error, projectId } = useConsultations();

  if (isPending) return <ConsultationSkeleton />;
  if (error) return <p role="alert" className="p-6 text-red-700">Unable to load consultations. Please try again.</p>;
  if (!projectId) return <p className="p-6">Select or register a research project to view consultations.</p>;
  if (!data) return null;

  const { list, next } = data;
  const history = list.filter((c) => c.status === "done");

  return (
    <PageContainer className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Consultations</h1>
        <ConsultationBooking key={projectId} projectId={projectId} firstName={user?.firstName} />
      </header>

      <NextConsultationCard consultation={next} />
      <ConsultationHistoryList history={history} />
    </PageContainer>
  );
}
