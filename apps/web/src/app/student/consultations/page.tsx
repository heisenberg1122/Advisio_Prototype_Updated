"use client";

import { useConsultations } from "@/hooks/use-student";
import { BookSlotCard } from "@/components/consultations/BookSlotCard";
import { NextConsultationCard } from "@/components/consultations/NextConsultationCard";
import { ConsultationHistoryList } from "@/components/consultations/ConsultationHistoryList";
import { ConsultationSkeleton } from "@/components/consultations/ConsultationSkeleton";
import { PageContainer } from "@/components/ui/PageContainer";

export default function ConsultationsPage() {
  const { data, isPending } = useConsultations();

  if (isPending) return <ConsultationSkeleton />;
  if (!data) return null;

  const { list, next } = data;
  const history = list.filter((c) => c.status === "done");
  const today = new Date();
  const visibleDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 3);
    return date;
  });

  return (
    <PageContainer className="flex flex-col gap-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4" aria-label="Consultation calendar">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="shrink-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Consultation calendar</p>
            <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)] dark:text-white">
              {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {visibleDays.map((date) => {
              const isToday = date.toDateString() === today.toDateString();
              return (
                <div
                  key={date.toISOString()}
                  className={`flex min-w-11 flex-col items-center rounded-xl px-2.5 py-2.5 text-center transition sm:min-w-16 ${
                    isToday
                      ? "bg-[var(--color-primary)] text-white shadow-xs font-black"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)]/70 text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="mt-1 text-sm font-black">{date.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BookSlotCard />
        <NextConsultationCard consultation={next} />
      </div>

      <ConsultationHistoryList history={history} />
    </PageContainer>
  );
}
