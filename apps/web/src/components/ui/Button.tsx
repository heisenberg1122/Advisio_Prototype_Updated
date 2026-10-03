import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "gold" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#0B3A53] text-white border border-[#0B3A53] hover:bg-[#072A3D] hover:border-[#072A3D] focus:ring-[#FFA400]/40 shadow-sm",
  accent:
    "bg-[#FFA400] text-[#072A3D] border border-transparent hover:bg-[#E09000] font-bold focus:ring-[#0B3A53]/30 shadow-sm",
  gold:
    "bg-[#FFA400] text-[#072A3D] border border-transparent hover:bg-[#E09000] font-bold focus:ring-[#0B3A53]/30 shadow-sm",
  secondary:
    "bg-white dark:bg-[#101b2b] text-[#17212B] dark:text-white border border-[#E2E8F0] dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 focus:ring-[#0B3A53]/20 shadow-xs",
  outline:
    "bg-transparent text-[#0B3A53] dark:text-[#FFA400] border border-[#0B3A53]/30 dark:border-white/20 hover:bg-[#EAF3F7] dark:hover:bg-white/10 focus:ring-[#0B3A53]/20",
  ghost:
    "bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 hover:text-[#0B3A53] dark:hover:bg-white/10 dark:hover:text-white",
  danger:
    "bg-[#C94A4A] text-white border border-[#C94A4A] hover:bg-[#b03d3d] focus:ring-[#C94A4A]/30 shadow-sm",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-10 px-3.5 text-xs rounded-xl gap-1.5 font-semibold",
  md: "h-11 px-5 text-sm rounded-xl gap-2 font-bold",
  lg: "h-12 px-6 text-base rounded-xl gap-2.5 font-bold",
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
        "focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#080E18]",
        "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}

      {children && <span className="truncate">{children}</span>}

      {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}
