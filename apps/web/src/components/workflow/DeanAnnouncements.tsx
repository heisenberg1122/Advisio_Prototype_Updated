import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function DeanAnnouncements({
  programs,
  assignedProgramId,
}: {
  programs: { id: string; name: string }[];
  assignedProgramId?: string;
}) {
  const [programId, setProgramId] = useState(assignedProgramId || "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const feed = useQuery({
    queryKey: ["dean-announcements"],
    queryFn: () =>
      apiClient.get<{
        announcements: {
          id: string;
          title: string;
          message: string;
          publishedAt: string;
        }[];
      }>("/api/notifications/announcements"),
  });
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 dark:border-white/20 dark:bg-slate-950 dark:text-white";
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900"
        onSubmit={async (event) => {
          event.preventDefault();
          setPublishing(true);
          setFeedback("");
          try {
            const result = await apiClient.post<{ recipientCount: number }>(
              "/api/notifications/announcements",
              {
                title,
                message,
                programId: assignedProgramId || programId || undefined,
              },
            );
            setFeedback(
              `Published to ${result.recipientCount} account(s) in the selected audience.`,
            );
            setTitle("");
            setMessage("");
            await feed.refetch();
          } catch (error) {
            setFeedback(
              error instanceof Error
                ? error.message
                : "Unable to publish announcement.",
            );
          } finally {
            setPublishing(false);
          }
        }}
      >
        <h1 className="text-xl font-bold">Post an announcement</h1>
        <p className="text-sm text-slate-500">
          Notify active accounts in your assigned college or department.
        </p>
        <label className="block text-sm font-bold">
          Audience
          <select
            value={assignedProgramId || programId}
            onChange={(event) => setProgramId(event.target.value)}
            disabled={Boolean(assignedProgramId)}
            className={inputClass}
          >
            {!assignedProgramId && (
              <option value="">Entire assigned college</option>
            )}
            {programs
              .filter(
                (program) =>
                  !assignedProgramId || program.id === assignedProgramId,
              )
              .map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Title
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-bold">
          Message
          <textarea
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          disabled={publishing}
          className="rounded-xl bg-[#173f63] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {publishing ? "Publishing…" : "Publish announcement"}
        </button>
        {feedback && (
          <p role="status" className="text-sm">
            {feedback}
          </p>
        )}
      </form>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Current announcements</h2>
        {feed.isLoading && <p>Loading announcements…</p>}
        {feed.isError && <p role="alert">Announcements could not be loaded.</p>}
        {feed.data?.announcements.map((announcement) => (
          <article
            key={announcement.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"
          >
            <h3 className="font-bold">{announcement.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {announcement.message}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {new Date(announcement.publishedAt).toLocaleDateString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            </p>
          </article>
        ))}
        {feed.data?.announcements.length === 0 && (
          <p>No current announcements.</p>
        )}
      </div>
    </section>
  );
}
