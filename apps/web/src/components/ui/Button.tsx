import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "accent"
    | "gold"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] focus:ring-[var(--college-focus-ring)] shadow-xs",
  accent:
    "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] font-semibold focus:ring-[var(--college-focus-ring)] shadow-xs",
  gold: "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] font-semibold focus:ring-[var(--college-focus-ring)] shadow-xs",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] focus:ring-[var(--college-focus-ring)] shadow-xs",
  outline:
    "bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)]/30 dark:border-white/20 hover:bg-[var(--color-primary-light)] focus:ring-[var(--college-focus-ring)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)]",
  danger:
    "bg-[#C94A4A] text-white border border-[#C94A4A] hover:bg-[#b03d3d] focus:ring-[#C94A4A]/30 shadow-xs",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 px-3.5 py-2 text-sm rounded-xl gap-1.5 font-semibold",
  md: "min-h-10 px-4 py-2 text-sm rounded-xl gap-2 font-semibold",
  lg: "min-h-11 px-5 py-2.5 text-base rounded-xl gap-2.5 font-semibold",
  icon: "h-10 w-10 p-0 rounded-xl justify-center",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none transition-all duration-150 ease-in-out cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}

      {children && <span className="min-w-0 break-words">{children}</span>}

      {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}
