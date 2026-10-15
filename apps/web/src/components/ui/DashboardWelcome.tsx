import React from "react";

type DashboardWelcomeProps = {
  firstName?: string | null;
  fallbackName: string;
  summary: string;
  actions?: React.ReactNode;
  className?: string;
};

export function DashboardWelcome({
  firstName,
  fallbackName,
  summary,
  actions,
  className = "",
}: DashboardWelcomeProps) {
  const displayName = firstName?.trim() || fallbackName;

  return (
    <section
      className={`college-hero-surface relative overflow-hidden rounded-2xl border p-6 text-[var(--color-text-primary)] sm:p-7 ${className}`}
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Today&apos;s overview
          </p>
          <h2 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight">
            Good day, {displayName}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {summary}
          </p>
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:justify-end shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
