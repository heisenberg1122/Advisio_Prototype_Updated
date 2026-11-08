"use client";

import { NotificationList } from "@/components/notifications/NotificationList";

export default function AdviserNotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-[1360px]">
      <NotificationList standalone />
    </div>
  );
}
