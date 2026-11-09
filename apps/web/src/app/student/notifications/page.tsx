"use client";

import { NotificationList } from "@/components/notifications/NotificationList";

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <NotificationList standalone />
    </div>
  );
}
