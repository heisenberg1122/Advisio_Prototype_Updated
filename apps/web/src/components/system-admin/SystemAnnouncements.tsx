import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

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

const severityStyles = {
  INFO: "bg-blue-50 text-blue-700 border-blue-200",
  WARNING: "bg-amber-50 text-amber-700 border-amber-200",
  CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
};

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)] gap-6">
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-5">
          <h2 className="font-extrabold text-[#1b4264] text-[16px]">Publish a system-wide announcement</h2>
          <p className="mt-1 text-[12px] text-slate-500">Every active user will receive this as an unread notification. Publishing is recorded in the audit log.</p>
        </div>

        {feedback && (
          <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-[12px] font-semibold ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {feedback.message}
          </div>
        )}

        <form onSubmit={publish} className="space-y-4">
          <div>
            <label htmlFor="announcement-title" className="mb-1.5 block text-[11px] font-bold text-slate-700">Title</label>
            <input id="announcement-title" required minLength={3} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[13px] outline-none focus:border-[#1b4264] focus:ring-2 focus:ring-[#1b4264]/10" placeholder="Scheduled maintenance on Saturday" />
          </div>
          <div>
            <label htmlFor="announcement-message" className="mb-1.5 block text-[11px] font-bold text-slate-700">Message</label>
            <textarea id="announcement-message" required minLength={10} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-[#1b4264] focus:ring-2 focus:ring-[#1b4264]/10" placeholder="Explain the impact, schedule, and what users need to do." />
            <div className="mt-1 text-right text-[10px] text-slate-400">{message.length}/5000</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="announcement-category" className="mb-1.5 block text-[11px] font-bold text-slate-700">Category</label>
              <select id="announcement-category" value={category} onChange={(event) => setCategory(event.target.value as Announcement["category"])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[12px]">
                <option value="GENERAL">General notice</option>
                <option value="UPDATE">Product update</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div>
              <label htmlFor="announcement-severity" className="mb-1.5 block text-[11px] font-bold text-slate-700">Priority</label>
              <select id="announcement-severity" value={severity} onChange={(event) => setSeverity(event.target.value as Announcement["severity"])} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[12px]">
                <option value="INFO">Information</option>
                <option value="WARNING">Important</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label htmlFor="announcement-expiry" className="mb-1.5 block text-[11px] font-bold text-slate-700">Expires (optional)</label>
              <input id="announcement-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[12px]" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <p className="text-[11px] text-slate-500">Review carefully. Publishing immediately notifies all active accounts.</p>
            <button disabled={publishing} className="shrink-0 rounded-lg bg-[#ffa400] px-4 py-2.5 text-[12px] font-extrabold text-[#1b4264] transition hover:bg-[#e89500] disabled:cursor-not-allowed disabled:opacity-60">
              {publishing ? "Publishing…" : "Publish announcement"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-extrabold text-[#1b4264] text-[16px]">Recent announcements</h2>
        <p className="mt-1 mb-4 text-[12px] text-slate-500">The latest notices published by System Administrators.</p>
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : isError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-[12px] text-rose-700">
            <p>{error instanceof Error ? error.message : "Announcements could not be loaded."}</p>
            <button onClick={() => void refetch()} className="mt-2 font-bold underline">Try again</button>
          </div>
        ) : !data?.announcements.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-[12px] text-slate-500">No announcements have been published.</div>
        ) : (
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {data.announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-extrabold text-slate-600">{announcement.category}</span>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-extrabold ${severityStyles[announcement.severity]}`}>{announcement.severity}</span>
                </div>
                <h3 className="text-[13px] font-extrabold text-[#1b4264]">{announcement.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">{announcement.message}</p>
                <p className="mt-3 text-[10px] text-slate-400">Published {new Date(announcement.publishedAt).toLocaleString()} by {announcement.creator.firstName} {announcement.creator.lastName}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
