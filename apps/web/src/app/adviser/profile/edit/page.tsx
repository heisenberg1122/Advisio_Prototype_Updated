"use client";

import React, { Suspense } from "react";
import { FacultyProfileEditForm } from "@/components/profile/FacultyProfileEditForm";
import { ProfileSkeleton } from "@/components/ui/Skeleton";

export default function AdviserEditProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton editing />}>
      <div>
        <FacultyProfileEditForm />
      </div>
    </Suspense>
  );
}
