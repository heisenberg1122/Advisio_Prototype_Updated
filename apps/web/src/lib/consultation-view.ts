import type { Consultation } from "@/types/student";

export function consultationViewModel(
  value: any,
): Consultation & {
  scheduledStart: string;
  scheduledEnd: string;
  meetingUrl: string;
} {
  const start = new Date(value.scheduledStart);
  const end = new Date(value.scheduledEnd);
  const time = (date: Date) =>
    date.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    });
  return {
    id: value.id,
    title: value.title || value.topic,
    date: start.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    timeRange: `${time(start)} – ${time(end)}`,
    duration: `${Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))} min`,
    adviser: value.adviser || "Assigned faculty",
    status:
      (
        {
          requested: "pending",
          scheduled: "confirmed",
          ongoing: "confirmed",
          completed: "done",
          cancelled: "cancelled",
        } as const
      )[String(value.status).toLowerCase() as "requested"] || "pending",
    scheduledStart: value.scheduledStart,
    scheduledEnd: value.scheduledEnd,
    meetingUrl: value.meetingUrl || "",
  };
}

export function nextConsultation<
  T extends { status: string; scheduledStart: string; scheduledEnd: string },
>(items: T[], now = Date.now()): T | null {
  return (
    items
      .filter(
        (item) =>
          ["pending", "confirmed"].includes(item.status) &&
          new Date(item.scheduledEnd).getTime() > now,
      )
      .sort(
        (left, right) =>
          new Date(left.scheduledStart).getTime() -
          new Date(right.scheduledStart).getTime(),
      )[0] || null
  );
}
