"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

interface ScanRecord {
  id: string;
  group: string;
  file: string;
  similarity: number;
  sources: number;
  status: "clear" | "warning" | "flagged";
  date: string;
}

export default function ProfessorPlagiarism() {
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([
    { id: "sr1", group: "Group Alpha", file: "Chapter_3_Methodology_v2.pdf", similarity: 12, sources: 3, status: "clear", date: "June 26, 2026" },
    { id: "sr2", group: "Group Beta", file: "Final_Draft_Complete_v1.pdf", similarity: 8, sources: 2, status: "clear", date: "June 25, 2026" },
    { id: "sr3", group: "Group Gamma", file: "Intro_Literature_v1.pdf", similarity: 28, sources: 11, status: "flagged", date: "June 24, 2026" },
    { id: "sr4", group: "Group Delta", file: "Chapter_2_Review_v2.pdf", similarity: 14, sources: 4, status: "clear", date: "June 23, 2026" },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const runScan = (id: string) => {
    showToast(`Scanning document for plagiarism matches in Capstone repository...`);
    setScanRecords(prev =>
      prev.map(r => {
        if (r.id === id) {
          // Adjust state randomly to simulate a successful scan
          return {
            ...r,
            similarity: Math.max(5, Math.min(30, r.similarity - 2)),
            date: "Just now"
          };
        }
        return r;
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
        
        {/* Scanned files table */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle icon="ti-shield-check">Plagiarism Similarity Index Log</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto mt-2">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-tertiary)] text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">Group & Document</th>
                    <th className="pb-3 font-semibold">Index</th>
                    <th className="pb-3 font-semibold">Sources</th>
                    <th className="pb-3 font-semibold">Scan Date</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-tertiary)]">
                  {scanRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-[var(--color-background-secondary)] transition-colors">
                      <td className="py-3">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">{record.group}</span>
                        <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{record.file}</div>
                      </td>
                      <td className="py-3">
                        <Tag variant={record.similarity > 20 ? "danger" : record.similarity > 12 ? "warn" : "success"}>
                          <i className="ti ti-fingerprint" /> {record.similarity}%
                        </Tag>
                      </td>
                      <td className="py-3 text-[var(--color-text-secondary)]">{record.sources} matching sites</td>
                      <td className="py-3 text-[var(--color-text-secondary)]">{record.date}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => runScan(record.id)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)] hover:bg-slate-800 transition cursor-pointer"
                        >
                          Scan File
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Configurations Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="h-full flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle icon="ti-settings">IP Scan Parameters</CardTitle>
              </CardHeader>

              <div className="flex flex-col gap-4 mt-2">
                <div className="p-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)]">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">Similarity Tolerance Thresholds</div>
                  <div className="flex flex-col gap-1.5 mt-2.5 text-[11px] text-[var(--color-text-secondary)]">
                    <div className="flex justify-between">
                      <span>Clear:</span>
                      <span className="text-green-400 font-medium">&lt; 15% Similarity</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Warning:</span>
                      <span className="text-amber-400 font-medium">15% - 25% Similarity</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flagged:</span>
                      <span className="text-red-400 font-medium">&gt; 25% Similarity</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)]">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">Database Search Repositories</div>
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-800 text-blue-500 w-3.5 h-3.5" />
                      <span>Google Scholar Publications</span>
                    </label>
                    <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-800 text-blue-500 w-3.5 h-3.5" />
                      <span>IEEE Xplore Digital Library</span>
                    </label>
                    <label className="flex items-center gap-2 text-[11.5px] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-800 text-blue-500 w-3.5 h-3.5" />
                      <span>Internal Academic Thesis Archive</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--color-border-tertiary)] pt-3 text-[11px] text-[var(--color-text-secondary)]">
              <i className="ti ti-info-circle text-[var(--color-text-info)] mr-1" />
              Files uploaded to the submissions system are automatically indexed. Similarity metrics are generated within 10-15 minutes of upload.
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
