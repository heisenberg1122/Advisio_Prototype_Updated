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
  primary: { bg: "bg-blue-50 dark:bg-sky-950/40", text: "text-[#0B3A53] dark:text-[#38bdf8]" },
  accent:  { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-[#FFA400] dark:text-[#fbbf24]" },
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
  const resolvedBg = iconBg || colorPreset?.bg || "bg-blue-50 dark:bg-white/10";
  const resolvedColor = colorPreset?.text || (typeof iconColor === "string" && !presetIconColorMap[iconColor] ? iconColor : "text-[#0B3A53] dark:text-[#FFA400]");

  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex min-h-[96px] items-center gap-4 rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-5 text-left transition-all duration-200",
        "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)]",
        onClick && "hover:shadow-[0_8px_20px_-4px_rgba(11,58,83,0.08)] hover:border-[#CBD5E1] hover:-translate-y-0.5 cursor-pointer select-none",
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
        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="block text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
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
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
            {trend?.label || description}
          </p>
        )}
      </div>
    </Component>
  );
}

