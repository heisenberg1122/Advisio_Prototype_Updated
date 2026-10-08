"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FilesPageSkeleton } from "@/components/ui/Skeleton";

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

  return <FilesPageSkeleton className="p-4 sm:p-4 lg:p-4" />;
}

export default StudentWorkspace;
