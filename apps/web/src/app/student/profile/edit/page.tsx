"use client";

import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export default function StudentEditProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <ProfileEditForm />
    </div>
  );
}
