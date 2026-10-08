"use client";

import { FacultyGroupChats } from "@/components/messaging/FacultyGroupChats";

export function StudentGroupChats({ triggerToast }: { triggerToast: (message: string) => void }) {
  return <FacultyGroupChats triggerToast={triggerToast} />;
}
