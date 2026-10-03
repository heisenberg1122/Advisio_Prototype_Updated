"use client";

import { Card } from "@/components/ui/Card";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <NotificationList />
      </Card>
    </div>
  );
}
