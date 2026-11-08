import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
import "./dean-announcements.css";

const TITLE_MAX = 200;
const MESSAGE_MAX = 5000;

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

export function DeanAnnouncements({
  programs,
  assignedProgramId,
}: {
  programs: { id: string; name: string }[];
  assignedProgramId?: string;
}) {
  const { user } = useAuth();
  const seal = getAcademicIdentity({ college: user?.college as any, program: user?.program as any })?.logoSrc;
  const [programId, setProgramId] = useState(assignedProgramId || "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
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
  const announcements = feed.data?.announcements || [];
  const audiencePrograms = programs.filter((program) => !assignedProgramId || program.id === assignedProgramId);
  const audienceName =
    audiencePrograms.find((program) => program.id === (assignedProgramId || programId))?.name ||
    "your entire assigned college";
  const status = feed.isLoading
    ? "Loading announcements…"
    : announcements.length
      ? `${announcements.length} current ${announcements.length === 1 ? "announcement" : "announcements"}`
      : "No announcements posted yet";

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setPublishing(true);
    setFeedback(null);
    try {
      const result = await apiClient.post<{ recipientCount: number }>("/api/notifications/announcements", {
        title,
        message,
        programId: assignedProgramId || programId || undefined,
      });
      setFeedback({
        tone: "ok",
        text: `Published to ${result.recipientCount} ${result.recipientCount === 1 ? "account" : "accounts"} in ${audienceName}.`,
      });
      setTitle("");
      setMessage("");
      await feed.refetch();
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Unable to publish announcement." });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="da" aria-labelledby="da-title">
      <header className="da-band">
        {seal && <img className="da-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <p>
          <strong id="da-title">Announcements</strong> · Dean&apos;s Office
        </p>
        <h1>{status}</h1>
      </header>

      <div className="da-body">
        <form className="da-compose" onSubmit={publish}>
          <h2>New announcement</h2>
          <p className="da-hint">Sent to active accounts in the audience you pick. It also appears in their Notifications.</p>

          <label className="da-field">
            <span>Audience</span>
            <select
              value={assignedProgramId || programId}
              onChange={(event) => setProgramId(event.target.value)}
              disabled={Boolean(assignedProgramId)}
            >
              {!assignedProgramId && <option value="">Entire assigned college</option>}
              {audiencePrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>

          <label className="da-field">
            <span>Title</span>
            <input
              required
              minLength={3}
              maxLength={TITLE_MAX}
              value={title}
              placeholder="e.g. Title defense schedule released"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="da-field">
            <span>Message</span>
            <textarea
              required
              minLength={10}
              maxLength={MESSAGE_MAX}
              rows={6}
              value={message}
              placeholder="Write the details people need: what, when and what to do."
              onChange={(event) => setMessage(event.target.value)}
              aria-describedby="da-count"
            />
            <small id="da-count" className="da-count">
              {message.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()}
            </small>
          </label>

          <div className="da-actions">
            {feedback && (
              <p role="status" className="da-feedback" data-tone={feedback.tone}>
                {feedback.text}
              </p>
            )}
            <button type="submit" className="da-publish" disabled={publishing}>
              <i className="ti ti-send" aria-hidden="true" />
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>

        <div className="da-side">
          <div className="da-side-head">
            <h2>Posted</h2>
            {!feed.isLoading && <span>{announcements.length} current</span>}
          </div>
          {feed.isError ? (
            <p role="alert" className="da-error">Announcements could not be loaded.</p>
          ) : feed.isLoading ? (
            <p className="da-muted">Loading announcements…</p>
          ) : announcements.length ? (
            <ul className="da-list">
              {announcements.map((announcement) => (
                <li key={announcement.id}>
                  <span className="da-icon" aria-hidden="true"><i className="ti ti-speakerphone" /></span>
                  <span className="da-item">
                    <strong>{announcement.title}</strong>
                    <span className="da-item-message">{announcement.message}</span>
                    <time dateTime={announcement.publishedAt}>{dateText(announcement.publishedAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="da-empty">
              <span aria-hidden="true"><i className="ti ti-speakerphone" /></span>
              <p>Nothing posted yet</p>
              <small>Your announcements show here with their date.</small>
            </div>
          )}

          <p className="da-preview-label">How it looks to recipients</p>
          <div className="da-preview" aria-live="polite">
            <span className="da-icon" aria-hidden="true"><i className="ti ti-speakerphone" /></span>
            <span className="da-item">
              <strong>{title.trim() || "Your title appears here"}</strong>
              <span className="da-item-message">{message.trim() || "The first lines of your message…"}</span>
              <small>Announcements · just now</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
