"use client";

import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

export default function PanelistSchedule() {
  const sessions = [
    { group: "Group Alpha", type: "Pre-Defense", title: "AI-based Crop Yield Prediction System Using ML", date: "June 29, 2026", time: "09:00 AM - 10:30 AM", room: "CS Lab 3 / Zoom", panel: "Dr. Rachel Lim (Chair), Dr. Lisa Wong, Dr. David Cho" },
    { group: "Group Delta", type: "Proposal Defense", title: "Automated Waste Sorting System using Computer Vision", date: "June 30, 2026", time: "01:00 PM - 02:30 PM", room: "CCS Room 402", panel: "Dr. Rachel Lim (Chair), Dr. Lisa Wong, Dr. David Cho" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle icon="ti-calendar">Assigned Defense Slots</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-4 mt-4">
          {sessions.map((session, idx) => (
            <div key={idx} className="bg-[var(--color-background-secondary)] p-4 rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] flex flex-col md:flex-row justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Tag variant="info" size="sm">{session.type}</Tag>
                  <span className="font-semibold text-xs text-white">{session.group}</span>
                </div>
                <h4 className="text-xs font-semibold text-slate-300 mt-2 leading-relaxed">{session.title}</h4>
                <div className="text-[10.5px] text-[var(--color-text-secondary)] mt-2 flex flex-col gap-1">
                  <span>Panel Members: {session.panel}</span>
                  <span className="text-[var(--color-text-info)] flex items-center gap-0.5"><i className="ti ti-map-pin" /> Room: {session.room}</span>
                </div>
              </div>

              <div className="bg-[var(--color-background-primary)] border border-[var(--color-border-tertiary)] px-4 py-3 rounded-[var(--border-radius-md)] text-center flex flex-col justify-center items-center w-40 h-fit self-start">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)]">Defense Slot</span>
                <span className="text-xs font-semibold text-white mt-1">{session.date}</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{session.time}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
