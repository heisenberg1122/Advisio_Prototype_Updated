"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function ConsultationsPage() {
  return (
    <div>
      <Card>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
          Consultation slots, schedules, logs, and video conferencing are managed through the central Adviser Dashboard. Click below to view.
        </p>
        <Link href="/dashboard" className="px-4 py-2 text-[12px] font-semibold bg-[var(--color-background-info)] border border-[var(--color-border-info)] text-[var(--color-text-info)] rounded-[var(--border-radius-md)] inline-block">
          Open Adviser Dashboard
        </Link>
      </Card>
    </div>
  );
}
