import { Link } from "react-router-dom";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import { Card, CardTitle } from "@/components/ui/Card";

export function BookSlotCard() {
  const { projectHref } = useActiveProjectContext();
  return (
    <Card className="flex min-h-[220px] flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
      <div>
        <CardTitle icon="ti-calendar-plus" className="mb-3 text-base text-[var(--color-text-primary)]">
          Request a consultation
        </CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Request a meeting with your assigned faculty. Your adviser will review and confirm the schedule.
        </p>
      </div>
      <Link to={projectHref("/student/dashboard?tab=consultations&book=1")} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-[var(--color-primary-dark)] active:scale-[0.98] cursor-pointer">
        <i className="ti ti-plus text-xs" aria-hidden="true" />
        Book a slot
      </Link>
    </Card>
  );
}
