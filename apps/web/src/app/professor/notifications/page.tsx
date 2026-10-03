"use client";

import { Card } from "@/components/ui/Card";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function ProfessorNotificationsPage() {
  return (
    <div>
      <Card>
        <NotificationList />
      </Card>
    </div>
  );
}
