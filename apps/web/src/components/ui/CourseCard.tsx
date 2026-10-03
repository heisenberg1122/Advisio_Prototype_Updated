"use client";

import React from "react";
import Link from "next/link";
import { Folder, ArrowRight, FileText, Video, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseCardAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface CourseCardProps {
  id?: string;
  title: string;
  code?: string;
  instructor?: string;
  instructorInitials?: string;
  instructorAvatar?: string;
  href?: string;
  bannerGradient?: string;
  statusBadge?: React.ReactNode;
  progress?: number;
  subtitle?: string;
  description?: string;
  actions?: CourseCardAction[];
  className?: string;
  onClick?: () => void;
}

export function CourseCard({
  title,
  code,
  instructor,
  instructorInitials,
  instructorAvatar,
  href,
  bannerGradient = "from-[#0B3A53] via-[#0E4968] to-[#072A3D]",
  statusBadge,
  progress,
  subtitle,
  description,
  actions,
  className,
  onClick,
}: CourseCardProps) {
  const initials = instructorInitials || (instructor ? instructor.slice(0, 2).toUpperCase() : "UA");

  const ContentWrapper = ({ children }: { children: React.ReactNode }) => {
    if (href) {
      return <Link href={href} className="block group">{children}</Link>;
    }
    return <div onClick={onClick} className={cn("group", onClick && "cursor-pointer")}>{children}</div>;
  };

  return (
    <div
      className={cn(
        "relative flex flex-col bg-white dark:bg-[#101b2b] border border-[#E2E8F0] dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-200 select-none",
        "shadow-xs hover:shadow-lg hover:border-[#BAC7D5] dark:hover:border-white/20 hover:-translate-y-1",
        className
      )}
    >
      <ContentWrapper>
        {/* Google Classroom Style Header Banner */}
        <div
          className={cn(
            "relative p-5 pb-7 text-white bg-gradient-to-r overflow-hidden min-h-[128px] flex flex-col justify-between",
            bannerGradient
          )}
        >
          {/* Subtle UA Gold Accent Flare */}
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#C9A227]/20 blur-xl pointer-events-none" />

          {/* Top Row: Code Badge & Status */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            {code && (
              <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded bg-black/25 text-white/95 backdrop-blur-xs border border-white/15">
                {code}
              </span>
            )}
            {statusBadge && <div className="ml-auto">{statusBadge}</div>}
          </div>

          {/* Course / Project Title with ellipsis */}
          <div className="relative z-10 mt-2 pr-12">
            <h3
              title={title}
              className="text-base sm:text-[17px] font-bold text-white tracking-tight leading-snug truncate group-hover:underline"
            >
              {title}
            </h3>

            {subtitle && (
              <p className="text-[11.5px] text-white/80 mt-0.5 truncate">
                {subtitle}
              </p>
            )}

            {instructor && (
              <p className="text-[11.5px] font-medium text-white/90 mt-1 truncate">
                {instructor}
              </p>
            )}
          </div>
        </div>
      </ContentWrapper>

      {/* Card Body with Overlapping Avatar */}
      <div className="relative px-5 pt-3 pb-3 flex-1 flex flex-col justify-between">
        {/* Overlapping Avatar */}
        <div className="absolute -top-6 right-5 z-20">
          {instructorAvatar ? (
            <img
              src={instructorAvatar}
              alt={instructor || "Instructor"}
              className="h-11 w-11 rounded-full ring-4 ring-white dark:ring-[#101b2b] shadow-md object-cover bg-white"
            />
          ) : (
            <div className="h-11 w-11 rounded-full ring-4 ring-white dark:ring-[#101b2b] shadow-md bg-[#0B3A53] text-[#FDF8E8] font-black text-xs flex items-center justify-center border border-[#C9A227]">
              {initials}
            </div>
          )}
        </div>

        {/* Description or details */}
        <div className="pt-2 min-h-[40px]">
          {description ? (
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {description}
            </p>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic">
              Active research stream
            </div>
          )}

          {/* Optional Milestone Progress Bar */}
          {progress !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <span>Progress</span>
                <span className="text-[#0B3A53] dark:text-[#C9A227] font-bold">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0B3A53] to-[#C9A227] transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Quick-Action Footer */}
        <div className="mt-3.5 pt-2.5 border-t border-[#F1F5F9] dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            {actions && actions.length > 0 ? (
              actions.map((act, i) => {
                const ActionIcon = act.icon || Folder;
                return act.href ? (
                  <Link
                    key={i}
                    href={act.href}
                    title={act.label}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-[#0B3A53] transition-colors"
                  >
                    <ActionIcon className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    key={i}
                    onClick={act.onClick}
                    title={act.label}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 hover:text-[#0B3A53] transition-colors"
                  >
                    <ActionIcon className="h-4 w-4" />
                  </button>
                );
              })
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#0B3A53] dark:text-[#C9A227]">
                <Folder className="h-3.5 w-3.5" />
                Materials
              </span>
            )}
          </div>

          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 font-semibold text-[11.5px] text-[#0B3A53] dark:text-[#C9A227] hover:underline"
            >
              <span>View Workspace</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
