"use client";

import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

export default function PanelistEvaluations() {
  const documents = [
    { group: "Group Alpha", title: "AI-based Crop Yield Prediction System Using ML", phase: "Pre-Defense", file: "Group_Alpha_PreDefense_Draft.pdf", similarity: 12, uploaded: "June 25, 2026" },
    { group: "Group Beta", title: "Smart Traffic Management System using IoT", phase: "Final Defense", file: "Group_Beta_FinalManuscript.pdf", similarity: 8, uploaded: "June 24, 2026" },
    { group: "Group Gamma", title: "Blockchain-based Academic Credentials System", phase: "Proposal", file: "Group_Gamma_Proposal_Revision2.pdf", similarity: 28, uploaded: "June 20, 2026" },
    { group: "Group Delta", title: "Automated Waste Sorting System using Computer Vision", phase: "Proposal", file: "Group_Delta_Proposal_Draft.pdf", similarity: 14, uploaded: "June 23, 2026" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle icon="ti-file-description">Group Artifacts & Manuscripts</CardTitle>
        </CardHeader>

        <div className="overflow-x-auto mt-4">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border-tertiary)] text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-semibold">Group & Project Title</th>
                <th className="pb-3 font-semibold">Manuscript Draft</th>
                <th className="pb-3 font-semibold">Similarity Index</th>
                <th className="pb-3 font-semibold">Submission Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-tertiary)]">
              {documents.map((doc, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-background-secondary)] transition-colors">
                  <td className="py-3.5 pr-3">
                    <span className="font-semibold text-xs text-[var(--color-text-primary)]">{doc.group}</span>
                    <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate max-w-[280px]">{doc.title}</div>
                  </td>
                  <td className="py-3.5">
                    <span className="text-xs text-blue-400 hover:underline cursor-pointer flex items-center gap-1">
                      <i className="ti ti-file-type-pdf text-base" /> {doc.file}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <Tag variant={doc.similarity > 20 ? "danger" : "success"}>
                      <i className="ti ti-fingerprint" /> {doc.similarity}%
                    </Tag>
                  </td>
                  <td className="py-3.5 text-[var(--color-text-secondary)]">{doc.uploaded}</td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => alert("Downloading PDF artifact...")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[var(--border-radius-md)] hover:bg-slate-800 transition cursor-pointer"
                    >
                      Download
                    </button>
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
