"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  category?: string;
  badge?: string;
  actions?: ReactNode;
  variant?: "card" | "banner" | "plain";
  className?: string;
}

/**
 * Standardized Page Header
 * Google Classroom-inspired banner or clean academic header with unified hierarchy, spacing, and action alignment.
 */
export function PageHeader({
  title,
  subtitle,
  category,
  badge,
  actions,
  variant = "card",
  className,
  ...props
}: PageHeaderProps) {
  if (variant === "card") {
    return (
      <section
        className={cn(
          "rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-6 sm:p-7 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4",
          className
        )}
        {...props}
      >
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2 mb-1.5">
              {category && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#FFA400]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[#0B3A53] dark:text-[#38bdf8]">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            {actions}
          </div>
        )}
      </section>
    );
  }
  if (variant === "plain") {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/10",
          className
        )}
        {...props}
      >
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2 mb-1">
              {category && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF3F7] dark:bg-white/10 text-[#0B3A53] dark:text-[#38bdf8]">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-[#17212B] dark:text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl bg-gradient-to-r from-[#0B3A53] via-[#102f49] to-[#173f63] p-6 text-white shadow-sm border border-[#0B3A53]/20 relative overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Subtle academic background glow */}
      <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 h-48 w-48 rounded-full bg-gradient-to-br from-[#C9A227]/15 to-transparent blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2">
              {category && (
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C9A227]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/30">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-xs md:text-sm text-slate-200">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}

export default PageHeader;
