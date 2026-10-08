"use client";

import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";

export function AdviserGroupChats({ triggerToast }: { triggerToast: (message: string) => void }) {
  return <FacultyGroupChats triggerToast={triggerToast} />;
}
