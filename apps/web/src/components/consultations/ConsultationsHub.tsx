import React from "react";
import type { ConsultationItem } from "@/lib/consultation-store";
import { relativeDays } from "@/lib/researcher-home";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { ConsultationActions } from "./ConsultationActions";
import "./consultations-hub.css";

const TZ = "Asia/Manila";
const PENDING = new Set(["pending", "requested"]);
const CLOSED = new Set(["cancelled", "canceled", "declined", "rejected"]);

type HubItem = ConsultationItem & { adviser?: string | null };

/** Session start in Manila time, from the stored timestamp or the date + time text. */
export function consultationStart(item: ConsultationItem): Date | null {
  if (item.scheduledStart) {
    const start = new Date(item.scheduledStart);
    if (!Number.isNaN(start.getTime())) return start;
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.date || "");
  if (!day) return null;
  const clock = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(item.time || "");
  let hour = clock ? Number(clock[1]) : 0;
  const minute = clock ? Number(clock[2]) : 0;
  const meridiem = clock?.[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const start = new Date(`${day[1]}-${day[2]}-${day[3]}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function statusOf(item: ConsultationItem, past: boolean) {
  const status = (item.status || "").toLowerCase();
  if (CLOSED.has(status)) return { tone: "closed", label: status === "declined" || status === "rejected" ? "Declined" : "Cancelled" };
  if (PENDING.has(status)) return { tone: "pending", label: past ? "Request not confirmed" : "Pending approval" };
  if (status === "provisioning") return { tone: "pending", label: item.conferenceState === "failed" ? "Calendar setup failed" : "Preparing Google Meet" };
  if (status === "completed") return { tone: "done", label: "Completed" };
  if (past) return { tone: "past", label: "Past" };
  return { tone: "confirmed", label: status === "ongoing" ? "In progress" : "Confirmed" };
}

function placeOf(item: ConsultationItem) {
  if (item.meetingUrl) return item.conferenceState === "manual" || item.conferenceState === "legacy" ? "Existing Meet link" : "Google Meet";
  if (item.mode && !/to be confirmed/i.test(item.mode)) return item.mode;
  return null;
}

const dayText = (date: Date) => date.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short" });
const timeText = (date: Date) => date.toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function ConsultationsHub({
  consultations,
  projectTitle,
  linkedId,
  linkedRef,
  booking,
  onInstantMeet,
  onJoin,
  onNotes,
  onCopyLink,
}: {
  consultations: ConsultationItem[];
  projectTitle?: string;
  linkedId?: string;
  linkedRef: React.RefObject<HTMLLIElement | null>;
  booking: React.ReactNode;
  onInstantMeet: () => void;
  onJoin: (item: ConsultationItem) => void;
  onNotes: (item: ConsultationItem) => void;
  onCopyLink: (item: ConsultationItem) => void;
}) {
  const { user } = useAuth();
  const seal = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const now = Date.now();
  const rows = (consultations as HubItem[]).map((item) => {
    const start = consultationStart(item);
    const past = item.status === "completed" || (item.scheduledEnd ? Date.parse(item.scheduledEnd) < now : start ? start.getTime() + 3_600_000 < now : false);
    return { item, start, past, status: statusOf(item, past) };
  });
  type Row = (typeof rows)[number];
  const byStart = (a: Row, b: Row) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0);
  const upcoming = rows.filter((row) => !row.past && row.status.tone !== "closed").sort(byStart);
  const past = rows.filter((row) => row.past || row.status.tone === "closed").sort((a, b) => byStart(b, a));
  const completed = past.filter((row) => row.status.tone === "done");
  const needsAction = rows.filter(({ item }) => item.proof && "needsAction" in item.proof && item.proof.needsAction);
  const lastMet = completed[0];
  const followUp = completed.find((row) => row.item.actionItems?.length);
  const nextSession = upcoming[0];

  const stats = [
    {
      label: "Next session",
      value: nextSession?.start ? `${capitalize(relativeDays(nextSession.start, now))}, ${timeText(nextSession.start)}` : "None booked",
    },
    {
      label: "Last met",
      value: lastMet?.start ? capitalize(relativeDays(lastMet.start, now)) : "Not yet",
    },
    { label: "Sessions so far", value: `${completed.length} completed` },
    { label: "Follow-ups from last session", value: String(followUp?.item.actionItems?.length || 0) },
  ];

  const metaFor = ({ item, start, past: isPast }: Row) =>
    [
      start ? dayText(start) : item.date,
      start ? timeText(start) : item.time,
      start ? relativeDays(start, now) : null,
      placeOf(item),
      item.adviser ? `with ${item.adviser}` : null,
    ]
      .filter((part, index) => part && !(isPast && index === 4))
      .join(" · ");

  const actions = ({ item, past: isPast, status }: Row) => {
    const canJoin = !isPast && status.tone === "confirmed" && Boolean(item.meetingUrl);
    return (
      <div className="ch-actions">
        <button type="button" className="ch-btn" onClick={() => onNotes(item)}>
          <i className="ti ti-notes" aria-hidden="true" /> Notes &amp; chat
        </button>
        {canJoin && (
          <button type="button" className="ch-btn ch-icon" aria-label="Copy meeting link" title="Copy meeting link" onClick={() => onCopyLink(item)}>
            <i className="ti ti-copy" aria-hidden="true" />
          </button>
        )}
        {canJoin && (
          <button type="button" className="ch-btn ch-primary" onClick={() => onJoin(item)}>
            <i className="ti ti-video" aria-hidden="true" /> Join Meet
          </button>
        )}
        <ConsultationActions item={{ ...item, title: item.topic }} viewerId={user?.id}
          canWithdraw={item.createdBy === user?.id} />
      </div>
    );
  };

  const dateBlock = (start: Date | null) => (
    <span className="ch-date" aria-hidden="true">
      <span>{start ? start.toLocaleDateString("en-PH", { timeZone: TZ, month: "short" }) : "—"}</span>
      <strong>{start ? start.toLocaleDateString("en-PH", { timeZone: TZ, day: "numeric" }) : ""}</strong>
    </span>
  );

  const summary = (row: Row) => (
    <span className="ch-summary">
      <span className="ch-title">{row.item.topic}</span>
      <span className="ch-meta">
        {row.start && <span className="sr-only">{row.start.toLocaleDateString("en-PH", { timeZone: TZ, month: "long", day: "numeric" })}, </span>}
        {metaFor(row)}
      </span>
      <span className="ch-status" data-tone={row.status.tone}>{row.status.label}</span>
    </span>
  );

  return (
    <section className="ch" aria-labelledby="ch-title">
      <div className="ch-band">
        {seal && <img className="ch-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <div className="ch-band-top">
          <div className="min-w-0">
            <p className="ch-scope">
              <span id="ch-title" className="ch-name">Consultations</span>
              {projectTitle && <><span aria-hidden="true"> · </span><span>{projectTitle}</span></>}
            </p>
            <h1 data-guide="researcher-consultation-status">Your adviser sessions</h1>
          </div>
          <div className="ch-band-actions">
            {booking}
            <button type="button" className="ch-btn ch-btn-lg" onClick={onInstantMeet}>
              <i className="ti ti-video" aria-hidden="true" /> Instant Google Meet
            </button>
          </div>
        </div>
        {consultations.length > 0 && (
          <dl className="ch-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {!consultations.length ? (
        <div className="ch-empty">
          <i className="ti ti-calendar-off" aria-hidden="true" />
          <p>No consultations yet</p>
          <span>Use Book a Consultation Session to send your first request.</span>
        </div>
      ) : (
        <>
          {needsAction.length > 0 && <>
            <h2 className="ch-section">Needs your action</h2>
            <ul className="ch-thread">
              {needsAction.map(({ item }) => <li key={item.id}>
                <a className="ch-btn" href={`#consultation-${item.id}`}>
                  {item.proof?.status === "correction_requested" ? "Revise record" : "Confirm record"} · {item.topic}
                </a>
              </li>)}
            </ul>
          </>}
          <h2 className="ch-section">Upcoming</h2>
          {upcoming.length ? (
            <ul className="ch-upcoming">
              {upcoming.map((row, index) => (
                <li
                  key={row.item.id}
                  id={`consultation-${row.item.id}`}
                  ref={row.item.id === linkedId ? linkedRef : undefined}
                  tabIndex={row.item.id === linkedId ? -1 : undefined}
                  className="ch-next"
                  data-featured={index === 0}
                  data-linked={row.item.id === linkedId}
                >
                  {dateBlock(row.start)}
                  <span className="ch-next-body">
                    <span className="ch-head">
                      {summary(row)}
                      {actions(row)}
                    </span>
                    {index === 0 && followUp?.item.actionItems?.length ? (
                      <span className="ch-prep">
                        <span className="ch-prep-title">Before you meet · follow-ups from {followUp.start ? followUp.start.toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" }) : "your last session"}</span>
                        <ul>
                          {followUp.item.actionItems.map((task) => (
                            <li key={task}>
                              <i className="ti ti-circle" aria-hidden="true" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ch-none">Nothing scheduled. Book a session when you’re ready to meet.</p>
          )}
          {past.length > 0 && (
            <>
              <h2 className="ch-section">Past</h2>
              <ol className="ch-thread">
                {past.map((row) => (
                  <li
                    key={row.item.id}
                    id={`consultation-${row.item.id}`}
                    ref={row.item.id === linkedId ? linkedRef : undefined}
                    tabIndex={row.item.id === linkedId ? -1 : undefined}
                    className="ch-past"
                    data-linked={row.item.id === linkedId}
                  >
                    <span className="ch-rail">{dateBlock(row.start)}</span>
                    <span className="ch-next-body">
                      <span className="ch-head">
                        {summary(row)}
                        {actions(row)}
                      </span>
                      {row.item.notes && (
                        <span className="ch-feedback">
                          <i className="ti ti-message-2" aria-hidden="true" />
                          <span>
                            <small>Feedback{row.item.adviser ? ` from ${row.item.adviser}` : ""}</small>
                            <span className="whitespace-pre-wrap">{row.item.notes}</span>
                          </span>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}

