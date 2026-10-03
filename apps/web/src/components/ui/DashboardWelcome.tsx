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
      className={`relative overflow-hidden rounded-2xl border border-[#0B3A53]/30 bg-gradient-to-r from-[#0B3A53] via-[#0E4968] to-[#072A3D] p-6 text-white shadow-md shadow-[#0B3A53]/10 dark:border-white/10 sm:p-7 ${className}`}
    >
      {/* Subtle academic background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-48 w-48 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br from-[#FFA400]/15 to-transparent blur-2xl"
      />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#FFA400]">
            Today&apos;s overview
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Good day, {displayName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-200">
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
