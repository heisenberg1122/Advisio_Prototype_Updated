"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

interface StudentWorkspaceProps {
  triggerToast?: (msg: string) => void;
}

/**
 * Legacy StudentWorkspace shim:
 * Automatically forwards to the modern University Research Document Workspace (/student/documents).
 */
export function StudentWorkspace({ triggerToast }: StudentWorkspaceProps) {
  const router = useRouter();

  useEffect(() => {
    if (triggerToast) {
      triggerToast("Opening modern Document Workspace...");
    }
    router.replace("/student/documents");
  }, [router, triggerToast]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#101b2b] rounded-2xl border border-slate-200 dark:border-white/10 m-4">
      <div className="w-10 h-10 border-4 border-[#0B3A53] border-t-transparent rounded-full animate-spin mb-4" />
      <h3 className="text-base font-extrabold text-[#0B3A53] dark:text-white">
        Redirecting to Document Workspace
      </h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        Opening your live Google Docs Deliverable Workspace...
      </p>
    </div>
  );
}

export default StudentWorkspace;
