import React, { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: string | React.ComponentType<{ className?: string }>;
  iconBg?: string;
  iconColor?: "primary" | "accent" | "success" | "warning" | "danger" | string;
  trend?: {
    value: string;
    positive?: boolean;
    label?: string;
  };
  description?: string;
  className?: string;
  onClick?: () => void;
}

const presetIconColorMap: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-[var(--color-primary-light)]", text: "text-[var(--color-primary)]" },
  accent:  { bg: "bg-[var(--color-primary-light)]", text: "text-[var(--color-primary)]" },
  success: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-[#2E7D5B] dark:text-[#4ade80]" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-[#C58A18] dark:text-[#fbbf24]" },
  danger:  { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-[#C94A4A] dark:text-[#f87171]" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor = "primary",
  trend,
  description,
  className,
  onClick,
}: StatCardProps) {
  const Component = onClick ? "button" : "div";

  const colorPreset = presetIconColorMap[iconColor];
  const resolvedBg = iconBg || colorPreset?.bg || "bg-[var(--color-primary-light)]";
  const resolvedColor = colorPreset?.text || (typeof iconColor === "string" && !presetIconColorMap[iconColor] ? iconColor : "text-[var(--color-primary)]");

  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex min-h-[104px] items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left transition-all duration-200",
        "shadow-[var(--shadow-card-soft)]",
        onClick && "hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 cursor-pointer select-none",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl transition-transform",
            resolvedBg,
            resolvedColor
          )}
        >
          {typeof Icon === "string" ? (
            <i className={cn("ti", Icon)} />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--color-text-secondary)] truncate">
          {label}
        </span>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="block min-w-0 break-words text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center text-xs font-bold gap-0.5",
                trend.positive ? "text-[#2E7D5B]" : "text-[#C94A4A]"
              )}
            >
              {trend.positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {trend.value}
            </span>
          )}
        </div>
        {(description || trend?.label) && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)] truncate">
            {trend?.label || description}
          </p>
        )}
      </div>
    </Component>
  );
}
