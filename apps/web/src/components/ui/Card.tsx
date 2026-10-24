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
  primary: "border-[var(--color-primary)]",
  accent:  "border-[var(--color-primary)]",
  success: "border-emerald-500/40",
  warning: "border-amber-500/40",
  danger:  "border-rose-500/40",
  info:    "border-[var(--color-primary)]",
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
        "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-7 transition-all duration-200",
        "shadow-[var(--shadow-card-soft)]",
        interactive && "hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 cursor-pointer",
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
      className={cn("flex items-center gap-2.5 text-lg font-semibold text-[var(--color-text-primary)] leading-snug", className)}
      {...props}
    >
      {Icon && (
        typeof Icon === "string" ? (
          <i className={cn("ti", Icon, "text-base text-[var(--color-primary)]")} aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5 text-[var(--color-primary)] shrink-0" />
        )
      )}
      <span>{children}</span>
    </h3>
  );
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-base text-[var(--color-text-secondary)] mt-1 leading-normal", className)}>
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
    <div className={cn("flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border-subtle)]", className)}>
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
        "text-sm font-semibold text-[var(--color-primary)] cursor-pointer inline-flex items-center gap-1.5 hover:underline transition-all select-none",
        className
      )}
    >
      <span>{children}</span>
      <span aria-hidden="true">&rarr;</span>
    </button>
  );
}
