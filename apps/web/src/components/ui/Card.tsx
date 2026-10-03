import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  accentColor?: "primary" | "accent" | "success" | "warning" | "danger" | "info";
  interactive?: boolean;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  icon?: string | React.ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}

const accentBorderMap = {
  primary: "border-l-4 border-l-[#0B3A53]",
  accent:  "border-l-4 border-l-[#FFA400]",
  success: "border-l-4 border-l-[#2E7D5B]",
  warning: "border-l-4 border-l-[#C58A18]",
  danger:  "border-l-4 border-l-[#C94A4A]",
  info:    "border-l-4 border-l-[#0B3A53]",
};

export function Card({
  children,
  className,
  accentColor,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#101b2b] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-6 sm:p-7 transition-all duration-200",
        "shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)]",
        interactive && "hover:shadow-[0_8px_20px_-4px_rgba(11,58,83,0.08)] hover:border-[#CBD5E1] hover:-translate-y-0.5 cursor-pointer",
        accentColor && accentBorderMap[accentColor],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4 gap-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ icon: Icon, children, className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn("flex items-center gap-2.5 text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug", className)}
      {...props}
    >
      {Icon && (
        typeof Icon === "string" ? (
          <i className={cn("ti", Icon, "text-lg text-[#0B3A53] dark:text-[#FFA400]")} aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5 text-[#0B3A53] dark:text-[#FFA400] shrink-0" />
        )
      )}
      <span>{children}</span>
    </h3>
  );
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1", className)}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between pt-4 mt-4 border-t border-[#F1F5F9] dark:border-white/10", className)}>
      {children}
    </div>
  );
}

export function CardLink({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs sm:text-sm font-semibold text-[#0B3A53] dark:text-[#FFA400] cursor-pointer inline-flex items-center gap-1.5 hover:underline transition-all select-none",
        className
      )}
    >
      <span>{children}</span>
      <span aria-hidden="true">&rarr;</span>
    </button>
  );
}
