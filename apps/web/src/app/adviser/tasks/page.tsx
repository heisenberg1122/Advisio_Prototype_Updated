"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function TasksPage() {
  return (
    <div>
      <Card>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
          Adviser task lists and action items are handled on the central dashboard. Click below to view and track your tasks.
        </p>
        <Link href="/dashboard" className="px-4 py-2 text-[12px] font-semibold bg-[var(--color-background-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] rounded-[var(--border-radius-md)] inline-block">
          Open Adviser Dashboard
        </Link>
      </Card>
    </div>
  );
}
