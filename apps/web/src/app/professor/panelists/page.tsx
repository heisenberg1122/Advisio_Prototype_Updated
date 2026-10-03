"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

interface PanelistAllocation {
  id: string;
  groupName: string;
  projectTitle: string;
  panelists: string[];
  date: string;
  time: string;
}

export default function ProfessorPanelists() {
  const [allocations, setAllocations] = useState<PanelistAllocation[]>([
    { id: "pa1", groupName: "Group Alpha", projectTitle: "AI-based Crop Yield Prediction System Using ML", panelists: ["Dr. Rachel Lim", "Prof. Kenji Saito", "Dr. David Cho"], date: "June 29, 2026", time: "9:00 AM" },
    { id: "pa2", groupName: "Group Beta", projectTitle: "Smart Traffic Management System using IoT", panelists: ["Prof. Arthur Pendelton", "Dr. Lisa Wong", "Prof. Kenji Saito"], date: "June 29, 2026", time: "10:30 AM" },
    { id: "pa3", groupName: "Group Delta", projectTitle: "Automated Waste Sorting System using Computer Vision", panelists: ["Dr. Rachel Lim", "Dr. David Cho", "Dr. Lisa Wong"], date: "June 30, 2026", time: "1:00 PM" },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const reallocatePanel = (id: string) => {
    showToast(`Reallocating backup panelists for defense session...`);
    setAllocations(prev =>
      prev.map(p => {
        if (p.id === id) {
          // Swap panelists slightly
          return {
            ...p,
            panelists: [...p.panelists.slice(1), p.panelists[0]]
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="flex flex-col gap-6 relative">

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[var(--color-background-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] px-4 py-2.5 rounded-[var(--border-radius-md)] flex items-center gap-2 shadow-lg text-xs">
          <i className="ti ti-info-circle" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Allocations Table */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle icon="ti-users-group">Defense Panel Allocations</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto mt-2">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-tertiary)] text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">Group & Project</th>
                    <th className="pb-3 font-semibold">Panelists</th>
                    <th className="pb-3 font-semibold">Defense Slot</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-tertiary)]">
                  {allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-[var(--color-background-secondary)] transition-colors">
                      <td className="py-3">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">{alloc.groupName}</span>
                        <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate max-w-[200px]">{alloc.projectTitle}</div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          {alloc.panelists.map((p, idx) => (
                            <span key={idx} className="text-xs flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">{alloc.date}</span>
                        <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{alloc.time}</div>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => reallocatePanel(alloc.id)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)] hover:bg-slate-800 transition cursor-pointer"
                        >
                          Modify Panel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Panel Pool Availability */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="h-full flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle icon="ti-user-check">Panelist Pool Availability</CardTitle>
              </CardHeader>

              <div className="flex flex-col gap-3.5 mt-2">
                {[
                  { name: "Dr. Rachel Lim", activeCount: 2, status: "available" },
                  { name: "Prof. Arthur Pendelton", activeCount: 1, status: "available" },
                  { name: "Prof. Kenji Saito", activeCount: 2, status: "busy" },
                  { name: "Dr. David Cho", activeCount: 2, status: "available" },
                  { name: "Dr. Lisa Wong", activeCount: 2, status: "busy" },
                ].map((member, index) => (
                  <div key={index} className="flex justify-between items-center text-xs p-2 rounded bg-[var(--color-background-secondary)]">
                    <span className="font-medium">{member.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--color-text-secondary)]">{member.activeCount} panels assigned</span>
                      <span className={`w-2 h-2 rounded-full ${member.status === "available" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--color-border-tertiary)] pt-3 text-[11px] text-[var(--color-text-secondary)] italic">
              <i className="ti ti-info-circle text-[var(--color-text-info)] mr-1" />
              Panel allocations must comprise 3 panelists representing matching Capstone domain specializations (e.g. ML, IoT, Blockchain).
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
