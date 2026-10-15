"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string }> | string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Standardized EmptyState
 * Provides consistent spacing, icon badge, and actionable layout for empty lists, search results, or queues.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
  ...props
}: EmptyStateProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === "string") {
      return (
        <i
          className={cn(
            "ti",
            Icon,
            isSm ? "text-xl" : isLg ? "text-3xl" : "text-2xl",
            "text-[var(--color-primary)]"
          )}
          aria-hidden="true"
        />
      );
    }
    const LucideIcon = Icon;
    return (
      <LucideIcon
        className={cn(
          isSm ? "h-5 w-5" : isLg ? "h-8 w-8" : "h-6 w-6",
          "text-[var(--color-primary)] stroke-[1.75]"
        )}
      />
    );
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-center flex flex-col items-center justify-center",
        isSm ? "p-5 sm:p-6 gap-2" : isLg ? "p-8 sm:p-12 gap-3" : "p-6 sm:p-9 gap-2.5",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mb-0.5",
            isSm ? "h-10 w-10" : isLg ? "h-14 w-14 rounded-2xl" : "h-12 w-12"
          )}
        >
          {renderIcon()}
        </div>
      )}
      <h3
        className={cn(
          "font-semibold text-[var(--color-text-primary)]",
          isSm ? "text-sm" : isLg ? "text-base sm:text-lg" : "text-sm sm:text-base"
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
