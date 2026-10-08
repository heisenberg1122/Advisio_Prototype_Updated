"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ProfileSkeleton } from "@/components/ui/Skeleton";

function SystemAdminProfilePageContent() {
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
    <div>
      {toast && (
        <div className="fixed top-5 right-5 z-55 bg-[#1b4264] border-l-4 border-[#ffa400] text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <i className="ti ti-circle-check text-[#ffa400] text-lg" />
          <span className="text-[12px] font-bold">{toast}</span>
        </div>
      )}

      <ProfileCard />
    </div>
  );
}

export default function SystemAdminProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <SystemAdminProfilePageContent />
    </Suspense>
  );
}
