"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItemProps {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }> | string;
  tabName?: string;
  active?: boolean;
  badge?: string | number;
  badgeVariant?: "accent" | "primary" | "danger" | "neutral";
  collapsed?: boolean;
  onClick?: () => void;
  appearance?: "default" | "workspace";
}

export function NavItem({
  label,
  href,
  icon: Icon,
  tabName,
  active,
  badge,
  badgeVariant = "accent",
  collapsed = false,
  onClick,
}: NavItemProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  // Compute active state if not explicitly passed
  let isItemActive = active;
  if (isItemActive === undefined) {
    const cleanHref = href.split("?")[0].replace(/\/$/, "");
    const cleanPath = pathname.replace(/\/$/, "");

    if (
      tabName &&
      (href.includes("?tab=") || cleanHref.endsWith("/dashboard"))
    ) {
      isItemActive = cleanPath === cleanHref && currentTab === tabName;
    } else if (href.includes("?tab=")) {
      const targetTab = new URLSearchParams(href.split("?")[1]).get("tab");
      isItemActive = cleanPath === cleanHref && currentTab === targetTab;
    } else {
      isItemActive =
        cleanPath === cleanHref || cleanPath.startsWith(cleanHref + "/");
    }
  }

  const renderIcon = () => {
    if (typeof Icon === "string") {
      return (
        <i
          className={cn(
            "ti",
            Icon,
            "shrink-0 text-xl leading-none flex items-center justify-center",
          )}
          aria-hidden="true"
        />
      );
    }
    const LucideIcon = Icon;
    return <LucideIcon className="h-5 w-5 shrink-0 transition-colors" />;
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center select-none outline-none transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]",
        collapsed
          ? "h-11 w-11 mx-auto justify-center rounded-xl p-0"
          : "h-11 mx-2.5 px-3.5 rounded-xl gap-3.5 text-sm",
        isItemActive
          ? "bg-[var(--nav-active-bg)] text-[var(--color-primary)] font-semibold shadow-none"
          : "text-[var(--color-text-primary)]/80 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)] dark:text-slate-300 font-medium",
      )}
      aria-current={isItemActive ? "page" : undefined}
    >
      <span
        className={cn(
          "flex items-center justify-center shrink-0 w-5 h-5",
          isItemActive
            ? "text-[var(--color-primary)]"
            : "text-slate-500 group-hover:text-[var(--color-primary)] dark:text-slate-400",
        )}
      >
        {renderIcon()}
      </span>

      {!collapsed && (
        <span className="flex-1 truncate tracking-normal">{label}</span>
      )}

      {!collapsed && badge !== undefined && (
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            badgeVariant === "accent" &&
              "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]",
            badgeVariant === "primary" &&
              "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]",
            badgeVariant === "danger" && "bg-red-500 text-white",
            badgeVariant === "neutral" &&
              "bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
