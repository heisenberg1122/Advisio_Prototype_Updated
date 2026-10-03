"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Standardized DataTable Container
 * Provides responsive horizontal scrolling, consistent cell padding, typography, and borders.
 */
export function DataTable({ children, className, ...props }: DataTableProps) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-2xl border border-[#DDE3E8] dark:border-white/10 bg-white dark:bg-[#101b2b] shadow-xs",
        className
      )}
      {...props}
    >
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead
      className={cn(
        "bg-slate-50/80 dark:bg-white/5 border-b border-[#EEF2F6] dark:border-white/10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none",
        className
      )}
    >
      {children}
    </thead>
  );
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-[#EEF2F6] dark:border-white/5 transition-colors duration-100",
        onClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5",
        !onClick && "hover:bg-slate-50/50 dark:hover:bg-white/5",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("py-3.5 px-4 font-extrabold", className)}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("py-3.5 px-4 text-slate-700 dark:text-slate-200 align-middle", className)}>
      {children}
    </td>
  );
}

export default DataTable;
