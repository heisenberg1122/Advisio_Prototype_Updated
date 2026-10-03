"use client";

import { useState } from "react";
import { useSubmissions } from "@/hooks/use-student";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/types/student";

type TabFilter = "all" | SubmissionStatus;

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "pending",  label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "revision", label: "Needs revision" },
];

const statusVariant: Record<SubmissionStatus, "success" | "warn" | "danger"> = {
  approved: "success",
  pending:  "warn",
  revision: "danger",
};

const statusLabel: Record<SubmissionStatus, string> = {
  approved: "Approved",
  pending:  "Pending",
  revision: "Revision",
};

const iconMap: Record<SubmissionStatus, { icon: string; bg: string; color: string }> = {
  approved: { icon: "ti-check",   bg: "var(--color-background-success)", color: "var(--color-text-success)" },
  pending:  { icon: "ti-clock",   bg: "var(--color-background-warning)", color: "var(--color-text-warning)" },
  revision: { icon: "ti-refresh", bg: "var(--color-background-danger)",  color: "var(--color-text-danger)"  },
};

export default function SubmissionsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const { data: submissions, isPending } = useSubmissions();

  const filtered = submissions?.filter(
    (s) => activeTab === "all" || s.status === activeTab
  );

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Tabs */}
      <div className="flex border-b border-[#DDE3E8] dark:border-white/10 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px transition-colors duration-150 cursor-pointer",
              activeTab === tab.id
                ? "text-[#0B3A53] dark:text-[#C9A227] border-[#0B3A53] dark:border-[#C9A227]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-transparent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <Card>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[var(--color-background-secondary)] rounded" />
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          {filtered?.length === 0 ? (
            <div className="empty">No submissions match this filter.</div>
          ) : (
            filtered?.map((sub, i) => {
              const { icon, bg, color } = iconMap[sub.status];
              return (
                <div
                  key={sub.id}
                  className={cn(
                    "flex items-center gap-[10px] py-2",
                    i < (filtered?.length ?? 0) - 1 &&
                      "border-b border-[var(--color-border-tertiary)]"
                  )}
                >
                  <div
                    className="w-[30px] h-[30px] rounded-[var(--border-radius-md)] flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: bg }}
                    aria-hidden="true"
                  >
                    <i className={`ti ${icon}`} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">{sub.name}</div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)] mt-px">
                      Submitted {sub.submittedAt}
                      {sub.reviewer && ` · ${sub.reviewer}`}
                    </div>
                  </div>
                  <Tag variant={statusVariant[sub.status]} size="sm">
                    {statusLabel[sub.status]}
                  </Tag>
                </div>
              );
            })
          )}
        </Card>
      )}

      <div className="flex justify-end mt-2">
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] text-white px-5 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer">
          <i className="ti ti-upload" aria-hidden="true" />
          Upload new document
        </button>
      </div>
    </div>
  );
}
