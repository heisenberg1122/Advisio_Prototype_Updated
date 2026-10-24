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
          "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)] flex flex-col md:flex-row md:items-center justify-between gap-4",
          className
        )}
        {...props}
      >
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2 mb-1.5">
              {category && (
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="text-2xl sm:text-[26px] font-bold text-[var(--color-text-primary)] tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
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
          "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]",
          className
        )}
        {...props}
      >
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2 mb-1">
              {category && (
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="text-2xl sm:text-[26px] font-bold text-[var(--color-text-primary)] tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-base text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
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
        "college-hero-surface rounded-2xl p-6 text-[var(--color-text-primary)] border relative overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          {(category || badge) && (
            <div className="flex items-center gap-2">
              {category && (
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  {category}
                </span>
              )}
              {badge && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--college-focus-ring)]">
                  {badge}
                </span>
              )}
            </div>
          )}
          <h1 className="mt-1 text-2xl md:text-[26px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-base text-[var(--color-text-secondary)] leading-relaxed">
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
