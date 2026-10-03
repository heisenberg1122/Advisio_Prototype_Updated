"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileCard } from "@/components/profile/ProfileCard";

function StudentProfilePageContent() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("saved") === "true") {
      setToast("Profile updated successfully!");
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-[#0B3A53] border-l-4 border-[#C9A227] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#C9A227] text-lg" />
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}

      <ProfileCard />
    </div>
  );
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[#1b4264]">Loading Profile...</div>}>
      <StudentProfilePageContent />
    </Suspense>
  );
}
