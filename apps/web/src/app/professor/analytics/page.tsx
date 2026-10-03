"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Avatar } from "@/components/ui/Avatar";

export default function ProfessorAnalytics() {
  const [metricTimeframe, setMetricTimeframe] = useState<"week" | "month" | "semester">("week");

  // Mock data for groups metrics
  const groupActivity = [
    { name: "Group Alpha", submissions: 12, revisions: 4, consultations: 8, rating: 92 },
    { name: "Group Beta", submissions: 15, revisions: 2, consultations: 10, rating: 95 },
    { name: "Group Gamma", submissions: 6, revisions: 8, consultations: 4, rating: 68 },
    { name: "Group Delta", submissions: 9, revisions: 5, consultations: 6, rating: 84 },
  ];

  return (
    <div className="flex flex-col gap-6">
      
      <div className="flex justify-end">
        <div className="flex bg-[var(--color-background-primary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)] p-1">
          {(["week", "month", "semester"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMetricTimeframe(t)}
              className={`px-3 py-1 text-xs rounded-[var(--border-radius-sm)] transition cursor-pointer capitalize font-medium ${
                metricTimeframe === t
                  ? "bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card accentColor="info">
          <CardHeader>
            <CardTitle icon="ti-clipboard-list">Submission Success Rate</CardTitle>
          </CardHeader>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-semibold">82.4%</span>
            <span className="text-xs text-green-400 font-medium flex items-center gap-0.5">
              <i className="ti ti-arrow-up" /> +4.2%
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">Percentage of deliverables approved on first revision</p>
        </Card>

        <Card accentColor="success">
          <CardHeader>
            <CardTitle icon="ti-messages">Advising Touchpoints</CardTitle>
          </CardHeader>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-semibold">28 Hours</span>
            <span className="text-xs text-[var(--color-text-secondary)]">this {metricTimeframe}</span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">Total recorded advisor-advisee consultation hours</p>
        </Card>

        <Card accentColor="warning">
          <CardHeader>
            <CardTitle icon="ti-alert-triangle">Similarity Average</CardTitle>
          </CardHeader>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-semibold">15.5%</span>
            <span className="text-xs text-red-400 font-medium flex items-center gap-0.5">
              <i className="ti ti-arrow-up" /> +1.8%
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">Plagiarism score average across all scanned drafts</p>
        </Card>
      </div>

      {/* CHARTS CONTAINER ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Activity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle icon="ti-activity">Weekly Submissions Volume</CardTitle>
          </CardHeader>
          <div className="h-64 flex flex-col justify-between mt-4">
            {/* Custom Bar Graph */}
            <div className="flex items-end justify-between h-48 px-4 border-b border-[var(--color-border-tertiary)] pb-2 gap-4">
              {[
                { day: "Mon", val: 40 },
                { day: "Tue", val: 65 },
                { day: "Wed", val: 85 },
                { day: "Thu", val: 50 },
                { day: "Fri", val: 110 },
                { day: "Sat", val: 30 },
                { day: "Sun", val: 20 },
              ].map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[9px] text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.val}
                  </div>
                  <div
                    style={{ height: `${(d.val / 120) * 100}%` }}
                    className="w-full bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-[var(--border-radius-sm)] transition-all hover:brightness-110"
                  />
                  <span className="text-[10px] text-[var(--color-text-secondary)]">{d.day}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center text-xs text-[var(--color-text-secondary)] mt-2">
              <span>Peak activity: Friday (110 submissions)</span>
              <span>Total: 370 actions</span>
            </div>
          </div>
        </Card>

        {/* Chart 2: Phase Distribution */}
        <Card>
          <CardHeader>
            <CardTitle icon="ti-chart-donut">Phase Distribution (% of groups)</CardTitle>
          </CardHeader>
          <div className="flex flex-col justify-center h-64 mt-4 gap-4">
            {[
              { phase: "Proposal Preparation", pct: 25, color: "bg-blue-500", count: "1 group" },
              { phase: "Chapters 1-3 Writing", pct: 25, color: "bg-teal-500", count: "1 group" },
              { phase: "Pre-Defense Stage", pct: 25, color: "bg-amber-500", count: "1 group" },
              { phase: "Final Manuscript similarity check", pct: 25, color: "bg-emerald-500", count: "1 group" },
            ].map((p, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                    {p.phase}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">{p.count} ({p.pct}%)</span>
                </div>
                <div className="progress-bar-track w-full">
                  <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* GROUP ACTIVITY MONITOR */}
      <Card>
        <CardHeader>
          <CardTitle icon="ti-list-check">Group Activity Metrics & Rating</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-tertiary)] text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px] pb-2">
                <th className="pb-3 font-semibold">Group Name</th>
                <th className="pb-3 font-semibold">Total Submissions</th>
                <th className="pb-3 font-semibold">Revisions Issued</th>
                <th className="pb-3 font-semibold">Consultations Logged</th>
                <th className="pb-3 font-semibold">Activity Index</th>
                <th className="pb-3 font-semibold text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-tertiary)]">
              {groupActivity.map((group, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-background-secondary)] transition-colors">
                  <td className="py-3 font-medium">{group.name}</td>
                  <td className="py-3">{group.submissions}</td>
                  <td className="py-3 text-red-400">{group.revisions}</td>
                  <td className="py-3">{group.consultations}</td>
                  <td className="py-3">
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${group.rating >= 90 ? "bg-emerald-500" : group.rating >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${group.rating}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-right font-semibold">
                    <Tag variant={group.rating >= 90 ? "success" : group.rating >= 80 ? "info" : "warn"}>
                      {group.rating}%
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
    </div>
  );
}
