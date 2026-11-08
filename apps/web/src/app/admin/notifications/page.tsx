"use client";

import { NotificationList } from "@/components/notifications/NotificationList";

export default function AdminNotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-[1360px]">
      <NotificationList standalone />
    </div>
  );
}
