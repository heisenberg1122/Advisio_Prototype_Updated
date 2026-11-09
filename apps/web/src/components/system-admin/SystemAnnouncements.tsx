import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { NotificationListSkeleton } from "@/components/ui/Skeleton";
import { EmptyNote, InlineFeedback } from "@/components/ui/advisio";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";

type Announcement = {
  id: string;
  title: string;
  message: string;
  category: "GENERAL" | "UPDATE" | "MAINTENANCE";
  severity: "INFO" | "WARNING" | "CRITICAL";
  publishedAt: string;
  expiresAt?: string | null;
  creator: { firstName: string; lastName: string; email: string };
};

const severityLabel = { INFO: "Information", WARNING: "Important", CRITICAL: "Critical" };
const severityTone = { INFO: undefined, WARNING: "waiting", CRITICAL: "attention" } as const;
const categoryLabel = { GENERAL: "General notice", UPDATE: "Product update", MAINTENANCE: "Maintenance" };

export function SystemAnnouncements() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Announcement["category"]>("GENERAL");
  const [severity, setSeverity] = useState<Announcement["severity"]>("INFO");
  const [expiresAt, setExpiresAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["system-announcements"],
    queryFn: () => apiClient.get<{ announcements: Announcement[] }>("/api/notifications/admin/announcements"),
  });

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setPublishing(true);
    setFeedback(null);
    try {
      const result = await apiClient.post<{ recipientCount: number }>("/api/notifications/admin/announcements", {
        title,
        message,
        category,
        severity,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setTitle("");
      setMessage("");
      setCategory("GENERAL");
      setSeverity("INFO");
      setExpiresAt("");
      setFeedback({ tone: "success", message: `Announcement published to ${result.recipientCount} active users.` });
      await queryClient.invalidateQueries({ queryKey: ["system-announcements"] });
    } catch (publishError) {
      setFeedback({
        tone: "error",
        message: publishError instanceof ApiError ? publishError.message : "The announcement could not be published.",
      });
    } finally {
      setPublishing(false);
    }
  };

  const announcements = data?.announcements || [];
  return (
    <div className="rs">
      <RoleBand
        eyebrow="System administration"
        title="Announcements"
        titleId="sa-announcements-title"
        meta="Notices sent here reach every active user. Publishing is recorded in the audit log."
        counts={[
          { label: "Recent", value: announcements.length },
          { label: "Critical", value: announcements.filter((item) => item.severity === "CRITICAL").length, tone: announcements.some((item) => item.severity === "CRITICAL") ? "waiting" : undefined },
        ]}
        countsLabel="Announcement summary"
      />
      {feedback && <InlineFeedback tone={feedback.tone === "success" ? "ok" : "error"}>{feedback.message}</InlineFeedback>}
      <div className="rh-grid">
        <section className="rh-panel" style={{ paddingBlock: 6 }} aria-label="Recent announcements">
          {isLoading ? (
            <div style={{ padding: "14px 0" }}><NotificationListSkeleton rows={3} /></div>
          ) : isError ? (
            <div style={{ padding: "12px 0" }}>
              <EmptyNote
                layout="row"
                tone="problem"
                icon="ti-alert-circle"
                title={error instanceof Error ? error.message : "Announcements could not be loaded."}
                action={<button type="button" className="au-link" onClick={() => void refetch()}>Try again</button>}
              />
            </div>
          ) : announcements.length ? (
            <ul className="rs-feed">
              {announcements.map((announcement) => (
                <li key={announcement.id}>
                  <div className="rs-feed-top">
                    <span className="rh-pill" data-tone={severityTone[announcement.severity]}>{severityLabel[announcement.severity]}</span>
                    <span className="rh-pill">{categoryLabel[announcement.category]}</span>
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.message}</p>
                  <small>Published {new Date(announcement.publishedAt).toLocaleString()} by {announcement.creator.firstName} {announcement.creator.lastName}</small>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ padding: "12px 0" }}>
              <EmptyNote layout="row" icon="ti-speakerphone" title="No announcements have been published" text="Notices you publish will appear here." />
            </div>
          )}
        </section>
        <section className="rh-panel" style={{ height: "fit-content" }} aria-labelledby="sa-publish-title">
          <div className="rh-head"><h2 id="sa-publish-title">Publish to everyone</h2></div>
          <p className="rh-lede">Every active user receives this as an unread notification.</p>
          <form onSubmit={publish} className="rs-form">
            <label htmlFor="announcement-title">
              Title
              <input id="announcement-title" required minLength={3} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Scheduled maintenance on Saturday" />
            </label>
            <label htmlFor="announcement-message">
              Message
              <textarea id="announcement-message" required minLength={10} maxLength={5000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain the impact, schedule, and what users need to do." />
              <span className="rs-note" style={{ textAlign: "right", fontWeight: 400 }}>{message.length}/5000</span>
            </label>
            <div className="rs-form-two">
              <label htmlFor="announcement-category">
                Category
                <select id="announcement-category" value={category} onChange={(event) => setCategory(event.target.value as Announcement["category"])}>
                  <option value="GENERAL">General notice</option>
                  <option value="UPDATE">Product update</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </label>
              <label htmlFor="announcement-severity">
                Priority
                <select id="announcement-severity" value={severity} onChange={(event) => setSeverity(event.target.value as Announcement["severity"])}>
                  <option value="INFO">Information</option>
                  <option value="WARNING">Important</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </label>
            </div>
            <label htmlFor="announcement-expiry">
              Expires (optional)
              <input id="announcement-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <p className="rs-note">Review carefully. Publishing immediately notifies all active accounts.</p>
            <button className="rh-cta" disabled={publishing}>{publishing ? "Publishing…" : "Publish announcement"}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
