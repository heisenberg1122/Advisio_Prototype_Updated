import React from "react";
import { cn } from "@/lib/utils";
import type { AvatarVariant } from "@/types/student";

export type ExtendedAvatarVariant = AvatarVariant | "primary" | "accent";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials?: string;
  name?: string;
  src?: string;
  colorVariant?: ExtendedAvatarVariant;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "online" | "busy" | "offline";
  className?: string;
}

const variantStyles: Record<string, string> = {
  primary: "bg-[#0B3A53] text-white border-white/20",
  accent:  "bg-[#C9A227] text-[#072A3D] font-bold border-white/30",
  info:    "bg-[#EAF3F7] text-[#0B3A53] border-[#0B3A53]/20",
  success: "bg-[#EAF5EE] text-[#2E7D5B] border-[#2E7D5B]/25",
  warning: "bg-[#FEF7EA] text-[#C58A18] border-[#C58A18]/25",
  danger:  "bg-[#FDEEEE] text-[#C94A4A] border-[#C94A4A]/25",
};

const sizeStyles = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-[13px]",
  lg: "w-12 h-12 text-sm",
  xl: "w-14 h-14 text-base",
};

const statusStyles = {
  online: "bg-[#2E7D5B]",
  busy:   "bg-[#C58A18]",
  offline:"bg-slate-400",
};

export function Avatar({
  initials,
  name,
  src,
  colorVariant = "primary",
  size = "md",
  status,
  className,
  ...props
}: AvatarProps) {
  const displayInitials =
    initials ||
    (name
      ? name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "UA");

  return (
    <div className="relative inline-flex shrink-0" {...props}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold border select-none overflow-hidden transition-transform",
          variantStyles[colorVariant] || variantStyles.primary,
          sizeStyles[size],
          className
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name || "Avatar"}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <span>{displayInitials}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-[#101b2b]",
            statusStyles[status],
            size === "xs" || size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
