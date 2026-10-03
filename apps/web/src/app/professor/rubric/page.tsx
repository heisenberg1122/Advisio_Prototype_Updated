"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";

interface RubricCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export default function ProfessorRubrics() {
  const [rubrics, setRubrics] = useState<RubricCriterion[]>([
    { id: "rc1", name: "Problem Definition & Literature Review", weight: 15, description: "Depth of literature analysis, novelty statement, problem justification." },
    { id: "rc2", name: "Methodology & Research Design", weight: 20, description: "Appropriateness of methods, algorithm choices, execution framework." },
    { id: "rc3", name: "System Architecture & Engineering quality", weight: 25, description: "Prototype functionality, code standards, database design, IoT structure." },
    { id: "rc4", name: "Evaluation & Benchmarking results", weight: 20, description: "Thoroughness of testing, benchmarks, statistical correctness." },
    { id: "rc5", name: "Manuscript presentation & Writing standard", weight: 10, description: "Grammar, formatting, citation structure, logical flow." },
    { id: "rc6", name: "Defense oral presentation & Q&A response", weight: 10, description: "Clarity, presentation quality, ability to resolve panel queries." }
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleWeightChange = (id: string, newWeight: number) => {
    setRubrics(prev =>
      prev.map(r => (r.id === id ? { ...r, weight: newWeight } : r))
    );
  };

  const totalWeight = rubrics.reduce((acc, r) => acc + r.weight, 0);

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
        {/* Rubrics Form */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle icon="ti-category">Defence Rubric Weight Adjustments</CardTitle>
              <span className={`text-xs font-semibold ${totalWeight === 100 ? "text-green-400" : "text-red-400"}`}>
                Total: {totalWeight}% / 100%
              </span>
            </CardHeader>

            <div className="flex flex-col gap-4 mt-2">
              {rubrics.map((rubric) => (
                <div key={rubric.id} className="bg-[var(--color-background-secondary)] p-4 rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{rubric.name}</h4>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{rubric.description}</p>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-text-info)] whitespace-nowrap">{rubric.weight}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={rubric.weight}
                    onChange={(e) => handleWeightChange(rubric.id, Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Deploy & Summary Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="h-full flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle icon="ti-file-text">Deploy Rubric Configuration</CardTitle>
              </CardHeader>
              
              <div className="flex flex-col gap-4 mt-2">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  The panel grading sheet will dynamically update with the selected percentage weights during defenses.
                </p>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs p-2.5 rounded bg-[var(--color-background-secondary)]">
                    <span>Manuscript Standard</span>
                    <span className="font-semibold">{rubrics[0].weight + rubrics[1].weight + rubrics[4].weight}%</span>
                  </div>
                  <div className="flex justify-between text-xs p-2.5 rounded bg-[var(--color-background-secondary)]">
                    <span>Engineering Quality</span>
                    <span className="font-semibold">{rubrics[2].weight + rubrics[3].weight}%</span>
                  </div>
                  <div className="flex justify-between text-xs p-2.5 rounded bg-[var(--color-background-secondary)]">
                    <span>Oral Presentation</span>
                    <span className="font-semibold">{rubrics[5].weight}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  if (totalWeight !== 100) {
                    showToast("Weights must sum exactly to 100% before deploying.");
                    return;
                  }
                  showToast("Grading rubric deployed to all defense panels.");
                }}
                className="w-full py-2 bg-[var(--color-background-success)] border border-[var(--color-border-success)] text-[var(--color-text-success)] text-xs font-semibold rounded-[var(--border-radius-md)] hover:bg-opacity-80 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="ti ti-check" /> Deploy Rubric
              </button>
            </div>
          </Card>
        </div>
      </div>
      
    </div>
  );
}
