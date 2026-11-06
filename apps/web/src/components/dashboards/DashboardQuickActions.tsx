type DashboardAction = {
  label: string;
  icon: string;
  tab: string;
};

export function DashboardQuickActions({
  actions,
  onAction,
}: {
  actions: DashboardAction[];
  onAction: (tab: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-[#17212B] dark:text-white">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ label, icon, tab }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onAction(tab)}
            className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-slate-50/50 p-2 text-center transition hover:border-[#0B3A53] hover:bg-white hover:shadow-xs dark:border-white/15 dark:bg-white/5 dark:hover:border-[#C9A227] sm:flex-row sm:justify-start sm:gap-3 sm:p-3 sm:text-left"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0B3A53]/10 text-base text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227] sm:h-10 sm:w-10 sm:text-lg"
            >
              <i className={`ti ${icon}`} />
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere] text-sm font-bold text-[#17212B] dark:text-white">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
