"use client";

import { Card } from "@/components/ui/Card";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function AdminNotificationsPage() {
  return (
    <div>
      <Card>
        <NotificationList />
      </Card>
    </div>
  );
}
