import { Card, CardTitle } from "@/components/ui/Card";

export function BookSlotCard() {
  return (
    <Card className="flex min-h-64 flex-col justify-between rounded-2xl border-0 bg-slate-50/70 shadow-none dark:bg-white/[0.04]">
      <div>
      <CardTitle icon="ti-calendar-plus" className="mb-3 text-base">
        Request a consultation
      </CardTitle>
      <p className="mb-6 text-sm leading-6 text-[var(--color-text-secondary)]">
        Your adviser has open slots available.
      </p>
      </div>
      <button className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#0B3A53] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#072A3D] cursor-pointer">
        <i className="ti ti-plus" aria-hidden="true" />
        Book a slot
      </button>
    </Card>
  );
}
