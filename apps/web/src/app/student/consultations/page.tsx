"use client";

import { useConsultations } from "@/hooks/use-student";
import { BookSlotCard } from "@/components/consultations/BookSlotCard";
import { NextConsultationCard } from "@/components/consultations/NextConsultationCard";
import { ConsultationHistoryList } from "@/components/consultations/ConsultationHistoryList";
import { ConsultationSkeleton } from "@/components/consultations/ConsultationSkeleton";

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
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-white/[0.04] sm:px-6" aria-label="Consultation calendar">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="shrink-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Consultation calendar</p>
            <p className="mt-1 text-lg font-bold text-[#0B3A53] dark:text-white">
              {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {visibleDays.map((date) => {
              const isToday = date.toDateString() === today.toDateString();
              return (
                <div
                  key={date.toISOString()}
                  className={`flex min-w-10 flex-col items-center rounded-xl px-2 py-2 text-center sm:min-w-14 ${
                    isToday
                      ? "bg-[#0B3A53] text-white shadow-sm dark:bg-[#C9A227] dark:text-[#072A3D]"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span className="text-xs font-bold uppercase">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
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
    </div>
  );
}
