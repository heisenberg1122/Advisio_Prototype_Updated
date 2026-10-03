"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

interface TemplateMilestone {
  id: string;
  title: string;
  duration: string;
  tasksCount: number;
  locked: boolean;
}

export default function ProfessorMilestones() {
  const [activeTemplate, setActiveTemplate] = useState<"standard" | "extended" | "fast_track">("standard");
  const [milestones, setMilestones] = useState<TemplateMilestone[]>([
    { id: "tm1", title: "Proposal Endorsement & Title Approval", duration: "2 weeks", tasksCount: 3, locked: false },
    { id: "tm2", title: "Chapter 1-3 Research Draft Review", duration: "4 weeks", tasksCount: 5, locked: true },
    { id: "tm3", title: "Ethics Clearance & Prototype Deployment", duration: "3 weeks", tasksCount: 4, locked: true },
    { id: "tm4", title: "Pre-Defense Readiness Certificate", duration: "2 weeks", tasksCount: 2, locked: true },
    { id: "tm5", title: "Chapter 4-5 Manuscript Drafting", duration: "4 weeks", tasksCount: 6, locked: true },
    { id: "tm6", title: "Plagiarism Scan & Similarity Compliance", duration: "1 week", tasksCount: 2, locked: true },
    { id: "tm7", title: "Final Defense & Archive Submission", duration: "2 weeks", tasksCount: 3, locked: true },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleLock = (id: string) => {
    setMilestones(prev =>
      prev.map(m => (m.id === id ? { ...m, locked: !m.locked } : m))
    );
    const item = milestones.find(m => m.id === id);
    if (item) {
      triggerToast(`Milestone sequential lock ${!item.locked ? "enabled" : "disabled"} for "${item.title}"`);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[var(--color-background-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] px-4 py-2.5 rounded-[var(--border-radius-md)] flex items-center gap-2 shadow-lg text-xs">
          <i className="ti ti-info-circle" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TEMPLATE PICKER & ACTION BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-background-primary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-lg)] p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Curriculum Template:</span>
          <div className="flex bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)] p-1">
            <button
              onClick={() => {
                setActiveTemplate("standard");
                triggerToast("Loaded Standard Capstone Template");
              }}
              className={`px-3 py-1 text-xs rounded-[var(--border-radius-sm)] cursor-pointer font-medium ${
                activeTemplate === "standard" ? "bg-[var(--color-background-primary)] text-white" : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Standard CS/IT
            </button>
            <button
              onClick={() => {
                setActiveTemplate("extended");
                triggerToast("Loaded Extended 2-Semester Template");
              }}
              className={`px-3 py-1 text-xs rounded-[var(--border-radius-sm)] cursor-pointer font-medium ${
                activeTemplate === "extended" ? "bg-[var(--color-background-primary)] text-white" : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Extended Thesis
            </button>
            <button
              onClick={() => {
                setActiveTemplate("fast_track");
                triggerToast("Loaded Fast-Track Capstone Template");
              }}
              className={`px-3 py-1 text-xs rounded-[var(--border-radius-sm)] cursor-pointer font-medium ${
                activeTemplate === "fast_track" ? "bg-[var(--color-background-primary)] text-white" : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
            >
              Fast Track
            </button>
          </div>
        </div>

        <button
          onClick={() => triggerToast("Active Template deployed to all CCS student cohorts.")}
          className="px-4 py-1.5 bg-[var(--color-background-success)] border border-[var(--color-border-success)] text-[var(--color-text-success)] text-xs font-semibold rounded-[var(--border-radius-md)] hover:bg-opacity-80 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <i className="ti ti-circle-check" /> Deploy Template to Cohorts
        </button>
      </div>

      {/* MILESTONES PROGRESSION LIST */}
      <Card>
        <CardHeader>
          <CardTitle icon="ti-list-numbers">Template Phase Breakdown & Task Locking</CardTitle>
          <span className="text-xs text-[var(--color-text-secondary)]">Sequential progression configuration</span>
        </CardHeader>

        <div className="flex flex-col gap-3 mt-4">
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[var(--color-background-secondary)] rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[var(--color-background-info)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-info)]">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{m.title}</h4>
                  <div className="flex items-center gap-3 text-[10.5px] text-[var(--color-text-secondary)] mt-1">
                    <span className="flex items-center gap-1"><i className="ti ti-clock" /> Duration: {m.duration}</span>
                    <span className="text-[var(--color-text-tertiary)]">•</span>
                    <span className="flex items-center gap-1"><i className="ti ti-checklist" /> Tasks: {m.tasksCount} items</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[var(--color-text-secondary)]">Enforce linear sequencing:</span>
                <button
                  onClick={() => toggleLock(m.id)}
                  className={`px-3 py-1.5 text-[11px] font-medium border rounded-[var(--border-radius-md)] transition cursor-pointer flex items-center gap-1.5 ${
                    m.locked
                      ? "bg-red-950/20 border-red-900 text-red-400 hover:bg-opacity-80"
                      : "bg-[var(--color-background-primary)] border-[var(--color-border-tertiary)] text-[var(--color-text-secondary)] hover:text-white"
                  }`}
                >
                  <i className={m.locked ? "ti ti-lock" : "ti ti-lock-open"} />
                  {m.locked ? "Locked" : "Unlocked"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      
    </div>
  );
}
