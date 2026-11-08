import { useMemo, useState } from "react";
import { DateTile, EmptyNote, StatusDot, type StatusTone } from "@/components/ui/advisio";
import "./consultations-workspace.css";

export type AdviserConsultation = {
  id: string;
  topic: string;
  groupName?: string;
  date: string;
  time: string;
  status: string;
  meetingUrl?: string;
  scheduledStart?: string;
  researchId?: string;
};

type Stage = "approval" | "upcoming" | "past";
type Classified = AdviserConsultation & {
  stage: Stage;
  startsAt: number;
  label: string;
  tone: StatusTone;
};

const MANILA = "Asia/Manila";
const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: MANILA });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { month: "TBA", day: "—", weekday: "" };
  const weekday = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: MANILA, weekday: "short" });
  return { month: MONTHS[Number(match[2]) - 1] ?? "TBA", day: String(Number(match[3])), weekday };
}

function classify(item: AdviserConsultation, now: number): Classified {
  const status = String(item.status).toLowerCase();
  const startsAt = Date.parse(item.scheduledStart || `${item.date}T23:59:59+08:00`) || 0;
  const future = startsAt >= now;
  if (status === "cancelled" || status === "canceled") return { ...item, stage: "past", startsAt, label: "Cancelled", tone: "attention" };
  if (status === "completed") return { ...item, stage: "past", startsAt, label: "Completed", tone: "neutral" };
  if (status === "pending" || status === "requested") {
    return future
      ? { ...item, stage: "approval", startsAt, label: "Awaiting approval", tone: "waiting" }
      : { ...item, stage: "past", startsAt, label: "Not approved in time", tone: "neutral" };
  }
  if (status === "ongoing") return { ...item, stage: "upcoming", startsAt, label: "In progress", tone: "live" };
  return future
    ? { ...item, stage: "upcoming", startsAt, label: "Confirmed", tone: "done" }
    : { ...item, stage: "past", startsAt, label: "Past", tone: "neutral" };
}

export function AdviserConsultationsWorkspace({
  consultations,
  loading,
  error,
  onRetry,
  seal,
  onSchedule,
  onApprove,
  onJoin,
  onCopy,
}: {
  consultations: AdviserConsultation[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  seal?: string;
  onSchedule: () => void;
  onApprove: (item: AdviserConsultation) => Promise<void> | void;
  onJoin: (item: AdviserConsultation) => void;
  onCopy: (url: string) => void;
}) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const now = Date.now();

  const sessions = useMemo(() => consultations.map((item) => classify(item, now)), [consultations, now]);
  const approvals = sessions.filter((item) => item.stage === "approval").sort((a, b) => a.startsAt - b.startsAt);
  const upcoming = sessions.filter((item) => item.stage === "upcoming").sort((a, b) => a.startsAt - b.startsAt);
  const past = sessions.filter((item) => item.stage === "past").sort((a, b) => b.startsAt - a.startsAt);

  const todayKey = dayKey(new Date(now));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now + (index - 3) * 86_400_000);
    return {
      key: dayKey(date),
      weekday: date.toLocaleDateString("en-PH", { timeZone: MANILA, weekday: "short" }),
      day: date.toLocaleDateString("en-PH", { timeZone: MANILA, day: "numeric" }),
      full: date.toLocaleDateString("en-PH", { timeZone: MANILA, weekday: "short", month: "short", day: "numeric" }),
    };
  });
  const sessionsOn = (key: string) => sessions.filter((item) => item.date === key).sort((a, b) => a.startsAt - b.startsAt);
  // Open on the next day that has something scheduled, so the panel starts useful.
  const defaultDay = week.find((day) => day.key >= todayKey && sessionsOn(day.key).length)?.key ?? todayKey;
  const selectedDay = pickedDay && week.some((day) => day.key === pickedDay) ? pickedDay : defaultDay;
  const selected = week.find((day) => day.key === selectedDay) ?? week[3];
  const agenda = sessionsOn(selected.key);

  const next = [...approvals, ...upcoming].sort((a, b) => a.startsAt - b.startsAt).find((item) => item.stage === "upcoming") ?? null;
  const nextParts = next ? dateParts(next.date) : null;
  const summary = error
    ? "We couldn’t load your consultations."
    : [
        approvals.length ? `${approvals.length} ${approvals.length === 1 ? "request needs" : "requests need"} your approval.` : null,
        next && nextParts ? `Next session is ${nextParts.weekday}, ${nextParts.month} ${nextParts.day} at ${next.time}.` : null,
      ].filter(Boolean).join(" ") || "No upcoming sessions. Schedule one when a group needs guidance.";

  const approve = async (item: AdviserConsultation) => {
    setApprovingId(item.id);
    try {
      await onApprove(item);
    } finally {
      setApprovingId(null);
    }
  };

  const tile = (item: Classified, muted = false) => {
    const parts = dateParts(item.date);
    return <DateTile tone={item.tone === "live" ? "live" : muted ? "muted" : undefined} top={parts.month} bottom={parts.day} label={`${parts.month} ${parts.day}`} />;
  };

  const counts = [
    { label: "To approve", value: approvals.length, waiting: approvals.length > 0 },
    { label: "Upcoming", value: upcoming.length },
    { label: "Past", value: past.length },
  ];
  const nothingYet = !sessions.length;

  return (
    <div className="adviser-overview mx-auto flex w-full max-w-[1360px] flex-col gap-6">
      <section className="adviser-overview__hero" aria-labelledby="adviser-consultations-title">
        {seal && <img className="adviser-overview__seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <header className="adviser-overview__hero-heading">
          <div>
            <p className="adviser-overview__eyebrow">
              Consultations · {new Date(now).toLocaleDateString("en-PH", { timeZone: MANILA, weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 id="adviser-consultations-title">Your advising sessions</h1>
            <p>{summary}</p>
          </div>
          <dl className="adviser-overview__workload ac-counts" aria-label="Consultation summary">
            {counts.map((item) => (
              <div key={item.label} className="adviser-overview__workload-item ac-count" data-waiting={item.waiting ? "true" : undefined}>
                <dd className="adviser-overview__metric-value">{error || loading ? "—" : item.value}</dd>
                <dt className="adviser-overview__metric-label">{item.label}</dt>
              </div>
            ))}
          </dl>
        </header>
        <div className="adviser-overview__hero-actions">
          <button type="button" data-guide="adviser-consultation-open" className="adviser-overview__hero-primary" onClick={onSchedule}>
            <i className="ti ti-plus" aria-hidden="true" /> Schedule consultation
          </button>
        </div>
      </section>

      <div className="ac-grid">
        <div className="ac-col">
          {approvals.length > 0 && (
            <section className="ac-panel" aria-labelledby="ac-approval">
              <div className="ac-head">
                <h2 id="ac-approval">Needs your approval</h2>
                <span className="ac-pill" data-tone="waiting">{approvals.length}</span>
              </div>
              {approvals.map((item) => {
                const parts = dateParts(item.date);
                return (
                  <div key={item.id} className="ac-request">
                    {tile(item)}
                    <div className="ac-text">
                      <h3>{item.topic}</h3>
                      <p>{item.groupName || "Research group"} · {parts.weekday}, {item.time}</p>
                    </div>
                    <button type="button" className="ac-primary" disabled={Boolean(approvingId)} onClick={() => void approve(item)}>
                      <i className="ti ti-check" aria-hidden="true" /> {approvingId === item.id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          <section className="ac-panel" aria-labelledby="ac-upcoming">
            <div className="ac-head">
              <h2
                id="ac-upcoming"
                data-guide={!loading && !error ? "adviser-consultation-list" : undefined}
                data-guide-empty={nothingYet}
              >
                Upcoming
              </h2>
              <span className="ac-pill">{upcoming.length}</span>
            </div>
            {upcoming.length ? (
              <ul className="ac-list">
                {upcoming.map((item) => (
                  <li key={item.id} className="ac-row">
                    {tile(item)}
                    <div className="ac-text">
                      <h3>{item.topic}</h3>
                      <p>{item.groupName || "Research group"} · {item.time}</p>
                    </div>
                    <StatusDot tone={item.tone}>{item.label}</StatusDot>
                    <div className="ac-actions">
                      <button type="button" className="ac-secondary" data-guide={item.meetingUrl ? "adviser-consultation-meeting" : undefined} onClick={() => onJoin(item)}>
                        <i className="ti ti-video" aria-hidden="true" /> Join Meet
                      </button>
                      {item.meetingUrl && (
                        <button type="button" className="ac-icon" aria-label={`Copy meeting link for ${item.topic}`} title="Copy link" onClick={() => onCopy(item.meetingUrl as string)}>
                          <i className="ti ti-copy" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : error ? (
              <EmptyNote
                layout="row"
                tone="problem"
                icon="ti-alert-triangle"
                title="We couldn’t load your consultations"
                text="Your connection may have dropped. Try again in a moment."
                action={<button type="button" className="ac-secondary" onClick={onRetry}>Try again</button>}
              />
            ) : loading ? (
              <EmptyNote layout="row" icon="ti-calendar-time" title="Loading consultations…" />
            ) : (
              <EmptyNote
                layout="row"
                icon="ti-calendar-time"
                title="No upcoming sessions"
                text="Schedule an advising session, or approve a request when one comes in."
                action={<button type="button" className="ac-secondary" onClick={onSchedule}>Schedule one</button>}
              />
            )}
          </section>
        </div>

        <aside className="ac-panel ac-rail" aria-labelledby="ac-week">
          <h2 id="ac-week">This week</h2>
          <div className="ac-week" role="group" aria-label="Choose a day">
            {week.map((day) => {
              const count = sessionsOn(day.key).length;
              return (
                <button
                  key={day.key}
                  type="button"
                  className="ac-day"
                  aria-pressed={day.key === selected.key}
                  aria-label={`${day.full}, ${count} ${count === 1 ? "session" : "sessions"}`}
                  data-today={day.key === todayKey ? "true" : undefined}
                  data-has={count > 0 ? "true" : undefined}
                  onClick={() => setPickedDay(day.key)}
                >
                  {day.weekday}
                  <b>{day.day}</b>
                  <u aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="ac-agenda" aria-live="polite">
            <h3>{selected.full}</h3>
            {agenda.length ? (
              agenda.map((item) => (
                <div key={item.id} className="ac-agenda-item" data-tone={item.tone}>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{item.topic}</strong>
                    <small>{item.time} · {item.label}</small>
                  </div>
                </div>
              ))
            ) : (
              <p>No sessions on this day.</p>
            )}
          </div>
        </aside>
      </div>

      {past.length > 0 && (
        <section className="ac-panel" aria-labelledby="ac-past">
          <div className="ac-head">
            <h2 id="ac-past">Past sessions</h2>
            <span className="ac-pill">{past.length}</span>
          </div>
          <div className="ac-past">
            {past.map((item) => (
              <div key={item.id} className="ac-past-item">
                {tile(item, true)}
                <div className="ac-text">
                  <h3>{item.topic}</h3>
                  <p>{item.groupName || "Research group"} · {item.time}</p>
                </div>
                <StatusDot tone={item.tone}>{item.label}</StatusDot>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
