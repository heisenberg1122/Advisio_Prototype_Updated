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
  appearance = "default",
}: NavItemProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  // Compute active state if not explicitly passed
  let isItemActive = active;
  if (isItemActive === undefined) {
    const cleanHref = href.split("?")[0].replace(/\/$/, "");
    const cleanPath = pathname.replace(/\/$/, "");

    if (tabName && (href.includes("?tab=") || cleanHref.endsWith("/dashboard"))) {
      isItemActive = cleanPath === cleanHref && currentTab === tabName;
    } else if (href.includes("?tab=")) {
      const targetTab = new URLSearchParams(href.split("?")[1]).get("tab");
      isItemActive = cleanPath === cleanHref && currentTab === targetTab;
    } else {
      isItemActive = cleanPath === cleanHref || cleanPath.startsWith(cleanHref + "/");
    }
  }

  const renderIcon = () => {
    if (typeof Icon === "string") {
      return <i className={cn("ti", Icon, "shrink-0 text-lg")} aria-hidden="true" />;
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
        "group relative flex items-center text-sm font-medium transition-all duration-150 select-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        appearance === "workspace" ? "h-11 rounded-xl" : "h-10 rounded-xl",
        collapsed ? "justify-center px-0 w-10 mx-auto" : "gap-3 px-3 mx-2",
        isItemActive
          ? appearance === "workspace"
            ? "bg-[#DDEBF1] text-[#0B3A53] font-bold shadow-none dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]"
            : "bg-[#0B3A53] text-white font-bold shadow-sm dark:bg-[#C9A227] dark:text-[#072A3D]"
          : "text-slate-600 hover:bg-slate-100 hover:text-[#0B3A53] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      )}
      aria-current={isItemActive ? "page" : undefined}
    >
      <span
        className={cn(
          isItemActive
            ? appearance === "workspace"
              ? "text-[#0B3A53] dark:text-[#38bdf8]"
              : "text-[#FFA400] dark:text-[#072A3D]"
            : "text-slate-400 group-hover:text-[#0B3A53] dark:text-slate-400 dark:group-hover:text-white"
        )}
      >
        {renderIcon()}
      </span>

      {!collapsed && (
        <span className="flex-1 truncate text-sm tracking-normal">
          {label}
        </span>
      )}

      {!collapsed && badge !== undefined && (
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
            badgeVariant === "accent" && "bg-[#C9A227]/20 text-[#8A6A0B] dark:bg-[#C9A227]/30 dark:text-[#C9A227]",
            badgeVariant === "primary" && "bg-[#0B3A53] text-white",
            badgeVariant === "danger" && "bg-red-500 text-white",
            badgeVariant === "neutral" && "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
