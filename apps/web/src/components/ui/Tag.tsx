import React from "react";
import { cn } from "@/lib/utils";
import type { TagVariant } from "@/types/student";

export type ExtendedTagVariant = TagVariant | "primary" | "accent" | "warning" | "outline";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ExtendedTagVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  dot?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const variantStyles: Record<string, string> = {
  primary: "bg-[#0B3A53]/10 text-[#0B3A53] border-[#0B3A53]/25 dark:bg-[#0B3A53]/30 dark:text-[#38bdf8]",
  accent:  "bg-[#C9A227]/15 text-[#8A6A0B] border-[#C9A227]/35 dark:bg-[#C9A227]/25 dark:text-[#f6a800]",
  info:    "bg-[#EAF3F7] text-[#0B3A53] border-[#0B3A53]/20 dark:bg-[#0B3A53]/30 dark:text-[#38bdf8]",
  success: "bg-[#EAF5EE] text-[#2E7D5B] border-[#2E7D5B]/25 dark:bg-[#2E7D5B]/20 dark:text-[#4ade80]",
  warn:    "bg-[#FEF7EA] text-[#C58A18] border-[#C58A18]/30 dark:bg-[#C58A18]/20 dark:text-[#fbbf24]",
  warning: "bg-[#FEF7EA] text-[#C58A18] border-[#C58A18]/30 dark:bg-[#C58A18]/20 dark:text-[#fbbf24]",
  danger:  "bg-[#FDEEEE] text-[#C94A4A] border-[#C94A4A]/25 dark:bg-[#C94A4A]/20 dark:text-[#f87171]",
  neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
  outline: "bg-transparent text-slate-600 border-slate-300 dark:text-slate-400 dark:border-white/20",
};

const dotColors: Record<string, string> = {
  primary: "bg-[#0B3A53]",
  accent:  "bg-[#C9A227]",
  info:    "bg-[#0B3A53]",
  success: "bg-[#2E7D5B]",
  warn:    "bg-[#C58A18]",
  warning: "bg-[#C58A18]",
  danger:  "bg-[#C94A4A]",
  neutral: "bg-slate-400",
  outline: "bg-slate-500",
};

const sizeStyles = {
  xs: "text-[10px] px-2 py-0.5 gap-1",
  sm: "text-[11px] px-2.5 py-0.5 gap-1.5",
  md: "text-xs px-3 py-1 gap-1.5",
};

export function Tag({
  variant = "neutral",
  children,
  icon,
  dot = false,
  size = "sm",
  className,
  ...props
}: TagProps) {
  const currentVariant = variant === "warn" ? "warning" : variant;

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border leading-none select-none transition-colors",
        variantStyles[variant] || variantStyles.neutral,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColors[currentVariant] || "bg-current"
          )}
        />
      )}

      {icon && <span className="shrink-0">{icon}</span>}

      <span className="truncate">{children}</span>
    </span>
  );
}

export function Badge({
  children,
  variant = "accent",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "accent" | "danger" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 leading-none",
        variant === "primary" && "bg-[#0B3A53] text-white",
        variant === "accent" && "bg-[#C9A227] text-[#072A3D]",
        variant === "danger" && "bg-[#C94A4A] text-white",
        variant === "neutral" && "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300",
        className
      )}
    >
      {children}
    </span>
  );
}
