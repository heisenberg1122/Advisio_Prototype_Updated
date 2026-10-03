"use client";

import React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

export default function PanelistScoring() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-[var(--color-background-info)] flex items-center justify-center mb-4">
          <i className="ti ti-stars text-xl text-[var(--color-text-info)]" />
        </div>
        <h3 className="text-sm font-semibold text-white">Scoring sheet is integrated into your main Console</h3>
        <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mt-2 leading-relaxed">
          You can access the full interactive digital evaluation form directly on the main panelist dashboard console.
        </p>
        <Link
          href="/panelist/dashboard"
          className="mt-6 px-4 py-2 bg-[var(--color-background-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] text-xs font-semibold rounded hover:bg-opacity-80 transition cursor-pointer"
        >
          Go to Dashboard Console
        </Link>
      </Card>
    </div>
  );
}
