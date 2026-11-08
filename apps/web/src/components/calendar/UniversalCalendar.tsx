"use client";
import "./calendar-event-colors.css";
import "./universal-calendar.css";
import { Link } from "react-router-dom";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { CalendarSkeleton } from "@/components/ui/Skeleton";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { calendarDaysUntil } from "@/lib/researcher-home";

type CalendarEventType =
  | "ACADEMIC"
  | "CONSULTATION"
  | "DEFENSE"
  | "DEADLINE"
  | "MILESTONE"
  | "ANNOUNCEMENT"
  | "AVAILABILITY"
  | "OTHER";
type AvailabilityStatus =
  | "UNAVAILABLE"
  | "ON_LEAVE"
  | "OUT_OF_OFFICE"
  | "LIMITED_AVAILABILITY";

type CalendarEvent = {
  id: string;
  source: string;
  type: CalendarEventType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
  meetingUrl?: string | null;
  visibility: string;
  availabilityStatus?: AvailabilityStatus | null;
  blocksScheduling?: boolean;
  privateNotes?: string | null;
  creator?: { id: string; name: string } | null;
  canEdit?: boolean;
  program?: { code: string; name: string } | null;
  groups: { id: string; name: string }[];
  participantIds: string[];
  participantNames: string[];
  status?: string;
  invitationStatus?: string | null;
  invitationRole?: string | null;
  actionUrl?: string | null;
};

type CalendarOptions = {
  canCreate: boolean;
  canManageAvailability: boolean;
  canManageAll: boolean;
  groups: { id: string; name: string; programCode: string }[];
  people: { id: string; name: string; programCode?: string; roles: string[] }[];
};

type CalendarForm = {
  title: string;
  type: CalendarEventType;
  visibility: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  description: string;
  privateNotes: string;
  availabilityStatus: AvailabilityStatus;
  blocksScheduling: boolean;
  researchIds: string[];
  participantIds: string[];
};

type AvailabilityConflict = {
  eventId: string;
  userId: string;
  name: string;
  status: AvailabilityStatus;
  startsAt: string;
  endsAt: string;
};

const COLORS: Record<string, string> = {
  CONSULTATION: "calendar-event-tone calendar-event-tone--consultation",
  DEFENSE: "calendar-event-tone calendar-event-tone--defense",
  DEADLINE: "calendar-event-tone calendar-event-tone--deadline",
  MILESTONE: "calendar-event-tone calendar-event-tone--milestone",
  ACADEMIC: "calendar-event-tone calendar-event-tone--academic",
  ANNOUNCEMENT: "calendar-event-tone calendar-event-tone--announcement",
  AVAILABILITY: "calendar-event-tone calendar-event-tone--availability",
  OTHER: "calendar-event-tone calendar-event-tone--other",
};

const LEGEND_DOTS: Record<CalendarEventType, string> = {
  ACADEMIC: "calendar-legend-dot calendar-event-tone--academic",
  CONSULTATION: "calendar-legend-dot calendar-event-tone--consultation",
  DEFENSE: "calendar-legend-dot calendar-event-tone--defense",
  DEADLINE: "calendar-legend-dot calendar-event-tone--deadline",
  MILESTONE: "calendar-legend-dot calendar-event-tone--milestone",
  ANNOUNCEMENT: "calendar-legend-dot calendar-event-tone--announcement",
  AVAILABILITY: "calendar-legend-dot calendar-event-tone--availability",
  OTHER: "calendar-legend-dot calendar-event-tone--other",
};

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  UNAVAILABLE: "Unavailable",
  ON_LEAVE: "On leave",
  OUT_OF_OFFICE: "Out of office",
  LIMITED_AVAILABILITY: "Limited availability",
};

const TZ = "Asia/Manila";
const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDateTime = (date: Date) =>
  `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const dateKey = (date: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
const timeText = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
const toneClass = (type: string) => `calendar-event-tone--${(type || "OTHER").toLowerCase()}`;
const FILTER_TYPES: CalendarEventType[] = ["CONSULTATION", "DEADLINE", "MILESTONE", "DEFENSE", "ACADEMIC", "AVAILABILITY"];
const FILTER_LABELS: Partial<Record<CalendarEventType, string>> = {
  CONSULTATION: "Consultations",
  DEADLINE: "Deadlines",
  MILESTONE: "Milestones",
  DEFENSE: "Defenses",
  ACADEMIC: "Academic",
  AVAILABILITY: "Availability",
};
const shortDateText = (date: string) =>
  new Date(date).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const weekRangeText = (week: Date[]) => {
  const first = week[0];
  const last = week[week.length - 1];
  const month = (date: Date) => date.toLocaleDateString("en-PH", { month: "short" });
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}` : `${month(last)} ${last.getDate()}`;
  return `${month(first)} ${first.getDate()} – ${end}, ${last.getFullYear()}`;
};
const prettyType = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const defenseStatus = (event: CalendarEvent) => {
  if (event.source !== "DEFENSE") return null;
  if (
    ["PENDING", "RECONFIRMATION_REQUIRED"].includes(
      event.invitationStatus || "",
    )
  )
    return "Response required";
  if (event.invitationStatus === "DECLINED") return "Declined";
  if (event.status === "SCHEDULED") return "Confirmed";
  if (event.status === "PENDING_ACKNOWLEDGEMENT")
    return "Tentative · awaiting panel";
  if (event.status === "NEEDS_RESCHEDULING") return "Rescheduling";
  return event.status ? prettyType(event.status) : null;
};
const allDayText = (event: CalendarEvent) => {
  const start = new Date(event.startsAt);
  const inclusiveEnd = new Date(new Date(event.endsAt).getTime() - 1);
  const startText = start.toLocaleDateString("en-PH", {
    timeZone: TZ,
    dateStyle: "medium",
  });
  const endText = inclusiveEnd.toLocaleDateString("en-PH", {
    timeZone: TZ,
    dateStyle: "medium",
  });
  return startText === endText
    ? `${startText} · All day`
    : `${startText} – ${endText} · All day`;
};

function formForDate(day: Date, type: CalendarEventType): CalendarForm {
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    type === "AVAILABILITY" ? 0 : 9,
    0,
  );
  const end = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    type === "AVAILABILITY" ? 0 : 10,
    0,
  );
  return {
    title: type === "AVAILABILITY" ? "Unavailable" : "",
    type,
    visibility: "PARTICIPANTS",
    startsAt: type === "AVAILABILITY" ? localDate(start) : localDateTime(start),
    endsAt: type === "AVAILABILITY" ? localDate(end) : localDateTime(end),
    allDay: type === "AVAILABILITY",
    location: "",
    description: "",
    privateNotes: "",
    availabilityStatus: "UNAVAILABLE",
    blocksScheduling: type === "AVAILABILITY",
    researchIds: [],
    participantIds: [],
  };
}

function formForEvent(event: CalendarEvent): CalendarForm {
  const endForAllDay = new Date(new Date(event.endsAt).getTime() - 1);
  return {
    title: event.title,
    type: event.type,
    visibility: event.visibility,
    startsAt: event.allDay
      ? dateKey(event.startsAt)
      : localDateTime(new Date(event.startsAt)),
    endsAt: event.allDay
      ? dateKey(endForAllDay)
      : localDateTime(new Date(event.endsAt)),
    allDay: event.allDay,
    location: event.location || "",
    description: event.description || "",
    privateNotes: event.privateNotes || "",
    availabilityStatus: event.availabilityStatus || "UNAVAILABLE",
    blocksScheduling: Boolean(event.blocksScheduling),
    researchIds: event.groups.map((group) => group.id),
    participantIds: event.participantIds || [],
  };
}

function schedulePayload(form: CalendarForm) {
  if (!form.allDay) {
    return {
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    };
  }
  const start = new Date(`${form.startsAt}T00:00:00`);
  const inclusiveEnd = new Date(`${form.endsAt}T00:00:00`);
  inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
  return { startsAt: start.toISOString(), endsAt: inclusiveEnd.toISOString() };
}

export default function UniversalCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [composerDay, setComposerDay] = useState<Date | null>(null);
  const [form, setForm] = useState<CalendarForm>(() =>
    formForDate(new Date(), "CONSULTATION"),
  );
  const [conflicts, setConflicts] = useState<AvailabilityConflict[]>([]);
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [composerError, setComposerError] = useState("");

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + ((7 - gridEnd.getDay()) % 7));
  const days = useMemo(
    () =>
      Array.from(
        {
          length: Math.round(
            (gridEnd.getTime() - gridStart.getTime()) / 86_400_000,
          ),
        },
        (_, index) => {
          const day = new Date(gridStart);
          day.setDate(day.getDate() + index);
          return day;
        },
      ),
    [gridStart.getTime(), gridEnd.getTime()],
  );

  const lookAhead = new Date();
  lookAhead.setHours(0, 0, 0, 0);
  lookAhead.setDate(lookAhead.getDate() + 15);
  const rangeEnd = lookAhead > gridEnd ? lookAhead : gridEnd;
  const calendar = useQuery({
    queryKey: [
      "universal-calendar",
      gridStart.toISOString(),
      rangeEnd.toISOString(),
    ],
    queryFn: () =>
      apiClient.get<{
        events: CalendarEvent[];
        scope: { panelistRestricted: boolean };
      }>("/api/calendar", {
        params: { start: gridStart.toISOString(), end: rangeEnd.toISOString() },
      }),
  });
  const options = useQuery({
    queryKey: ["calendar-options"],
    queryFn: () => apiClient.get<CalendarOptions>("/api/calendar/options"),
  });

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() + 1,
      );
      grouped.set(
        dateKey(day),
        (calendar.data?.events || [])
          .filter(
            (event) =>
              new Date(event.startsAt) < end && new Date(event.endsAt) > start,
          )
          .sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
      );
    }
    return grouped;
  }, [calendar.data, days]);

  const upcoming = [...(calendar.data?.events || [])]
    .filter((event) => new Date(event.endsAt) >= new Date())
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, 6);
  const isPanelist =
    user?.roles.includes("PANELIST") && calendar.data?.scope.panelistRestricted;
  const canSchedule = Boolean(
    options.data?.canCreate || options.data?.canManageAvailability,
  );
  const selectedDayEvents = selectedDay
    ? eventsByDay.get(dateKey(selectedDay)) || []
    : [];

  const saveEvent = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingEvent
        ? apiClient.patch(`/api/calendar/${editingEvent.id}`, payload)
        : apiClient.post("/api/calendar", payload),
    onSuccess: async () => {
      const returnDay = composerDay;
      setComposerOpen(false);
      setEditingEvent(null);
      setConflicts([]);
      setConflictsAcknowledged(false);
      setComposerError("");
      await queryClient.invalidateQueries({ queryKey: ["universal-calendar"] });
      if (returnDay) setSelectedDay(returnDay);
    },
    onError: (error: any) =>
      setComposerError(
        error?.message || "The calendar entry could not be saved.",
      ),
  });

  const cancelEvent = useMutation({
    mutationFn: (eventId: string) =>
      apiClient.delete(`/api/calendar/${eventId}`),
    onSuccess: async () => {
      setSelectedEvent(null);
      await queryClient.invalidateQueries({ queryKey: ["universal-calendar"] });
    },
  });

  const openComposer = (day: Date, type?: CalendarEventType) => {
    const defaultType =
      type || (options.data?.canCreate ? "CONSULTATION" : "AVAILABILITY");
    setComposerDay(day);
    setEditingEvent(null);
    setForm(formForDate(day, defaultType));
    setConflicts([]);
    setConflictsAcknowledged(false);
    setComposerError("");
    setSelectedDay(null);
    setComposerOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setComposerDay(new Date(event.startsAt));
    setEditingEvent(event);
    setForm(formForEvent(event));
    setConflicts([]);
    setConflictsAcknowledged(false);
    setComposerError("");
    setSelectedEvent(null);
    setComposerOpen(true);
  };

  const updateForm = (patch: Partial<CalendarForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setConflicts([]);
    setConflictsAcknowledged(false);
  };

  const handleAllDayChange = (allDay: boolean) => {
    if (allDay) {
      updateForm({
        allDay,
        startsAt: form.startsAt.slice(0, 10),
        endsAt: form.endsAt.slice(0, 10),
      });
    } else {
      updateForm({
        allDay,
        startsAt: `${form.startsAt.slice(0, 10)}T09:00`,
        endsAt: `${form.endsAt.slice(0, 10)}T10:00`,
      });
    }
  };

  const submitComposer = async (event: FormEvent) => {
    event.preventDefault();
    setComposerError("");
    let schedule: { startsAt: string; endsAt: string };
    try {
      schedule = schedulePayload(form);
    } catch {
      setComposerError("Choose a valid start and end schedule.");
      return;
    }
    if (new Date(schedule.endsAt) <= new Date(schedule.startsAt)) {
      setComposerError("The end of the schedule must be after its start.");
      return;
    }

    if (form.type !== "AVAILABILITY" && !conflictsAcknowledged) {
      setCheckingConflicts(true);
      try {
        const response = await apiClient.post<{
          conflicts: AvailabilityConflict[];
        }>("/api/calendar/conflicts", {
          ...schedule,
          participantIds: form.participantIds,
          researchIds: form.researchIds,
          excludeEventId: editingEvent?.id,
        });
        if (response.conflicts.length) {
          setConflicts(response.conflicts);
          setCheckingConflicts(false);
          return;
        }
      } catch (error: any) {
        setComposerError(
          error?.message || "Availability could not be checked.",
        );
        setCheckingConflicts(false);
        return;
      }
      setCheckingConflicts(false);
    }

    saveEvent.mutate({
      ...form,
      ...schedule,
      title:
        form.type === "AVAILABILITY"
          ? AVAILABILITY_LABELS[form.availabilityStatus]
          : form.title,
    });
  };

  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [hidden, setHidden] = useState<Set<CalendarEventType>>(() => new Set());
  const now = new Date();
  const todayKey = dateKey(now);
  const seal = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const allEvents = calendar.data?.events || [];
  const eventsOn = (day: Date) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return allEvents
      .filter((item) => new Date(item.startsAt) < end && new Date(item.endsAt) > start)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  };
  const visibleOn = (day: Date) => eventsOn(day).filter((item) => !hidden.has(item.type));
  const toggleType = (type: CalendarEventType) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  const moveMonth = (step: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + step, 1));
  const moveWeek = (step: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + step * 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay() + index));
  const nextUp = upcoming.find((item) => item.type !== "AVAILABILITY" && !hidden.has(item.type)) || null;
  const relativeLabel = (item: CalendarEvent) => {
    const days = calendarDaysUntil(new Date(item.startsAt), now.getTime());
    if (days <= 0) return new Date(item.endsAt) > now && new Date(item.startsAt) <= now ? "happening now" : "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  };
  const monthCounts = allEvents.reduce<Partial<Record<CalendarEventType, number>>>((counts, item) => {
    const start = new Date(item.startsAt);
    if (start >= monthStart && start < monthEnd) counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});
  const agendaDays = days
    .filter((day) => day.getMonth() === cursor.getMonth())
    .map((day) => ({ day, items: visibleOn(day) }))
    .filter(({ items }) => items.length > 0);

  if (calendar.isLoading) return <CalendarSkeleton />;

  return (
    <div className="universal-calendar uc mx-auto w-full max-w-[1800px] p-3 sm:p-5 lg:p-6 xl:p-7">
        <section className="uc-card uc-main">
          <div className="uc-band">
            {seal && <img className="uc-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
            <div className="uc-band-main">
              <div className="uc-scope">
                <h1>Calendar</h1>
                <span aria-hidden="true">·</span>
                <span>
                  {isPanelist
                    ? "Events and defenses assigned to you"
                    : user?.program?.name || user?.college?.name || "Institution events assigned to you"}
                </span>
                <span aria-hidden="true">·</span>
                <span>Philippine time</span>
              </div>
              <div className="uc-toolbar-nav" data-tour="calendar-navigation">
                <h2>
                  {view === "week"
                    ? weekRangeText(weekDays)
                    : cursor.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
                </h2>
                <button type="button" className="uc-icon-btn" aria-label={view === "week" ? "Previous week" : "Previous month"} onClick={() => (view === "week" ? moveWeek(-1) : moveMonth(-1))}><ChevronLeft size={16} /></button>
                <button type="button" className="uc-btn" onClick={() => setCursor(new Date())}>Today</button>
                <button type="button" className="uc-icon-btn" aria-label={view === "week" ? "Next week" : "Next month"} onClick={() => (view === "week" ? moveWeek(1) : moveMonth(1))}><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="uc-band-side">
              {nextUp ? (
                <button type="button" className={`uc-next ${toneClass(nextUp.type)}`} onClick={() => setSelectedEvent(nextUp)}>
                  <span className="uc-next-date" aria-hidden="true">
                    <span>{new Date(nextUp.startsAt).toLocaleDateString("en-PH", { timeZone: TZ, month: "short" })}</span>
                    <strong>{new Date(nextUp.startsAt).toLocaleDateString("en-PH", { timeZone: TZ, day: "numeric" })}</strong>
                  </span>
                  <span className="uc-next-text">
                    <span className="uc-next-label">Next up · {relativeLabel(nextUp)}</span>
                    <span className="uc-next-title">{nextUp.title}</span>
                    <span className="uc-next-meta">
                      <span className="sr-only">{shortDateText(nextUp.startsAt)} · </span>
                      {nextUp.allDay ? "All day" : timeText(nextUp.startsAt)}
                      {nextUp.location ? ` · ${nextUp.location}` : ""}
                    </span>
                  </span>
                  <ChevronRight size={16} className="uc-next-arrow" aria-hidden="true" />
                </button>
              ) : (
                <div className="uc-next uc-next--empty">
                  <span className="uc-next-date" aria-hidden="true"><CalendarDays size={18} /></span>
                  <span className="uc-next-text">
                    <span className="uc-next-label">Next up</span>
                    <span className="uc-next-title">Nothing in the next 14 days</span>
                  </span>
                </div>
              )}
              {canSchedule && (
                <button type="button" onClick={() => openComposer(new Date())} className="uc-new">
                  <Plus size={16} aria-hidden="true" /> New entry
                </button>
              )}
            </div>
          </div>

          <div className="uc-toolbar">
            <div className="uc-filters" role="group" aria-label="Show event types">
              {FILTER_TYPES.map((type) => (
                <button key={type} type="button" className="uc-filter" aria-pressed={!hidden.has(type)} onClick={() => toggleType(type)}>
                  <i className={toneClass(type)} aria-hidden="true" />
                  {FILTER_LABELS[type]}
                  {monthCounts[type] ? <span className="uc-filter-count">{monthCounts[type]}</span> : null}
                </button>
              ))}
            </div>
            <div className="uc-views" role="group" aria-label="Calendar view">
              {(["month", "week", "agenda"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>
                  {option === "month" ? "Month" : option === "week" ? "Week" : "Agenda"}
                </button>
              ))}
            </div>
          </div>
          {calendar.isError ? (
            <div className="uc-error">
              <CalendarDays size={28} aria-hidden="true" />
              <p>The calendar could not be loaded.</p>
              <span>Refresh the page to try again.</span>
            </div>
          ) : view === "agenda" ? (
            <div className="uc-agenda">
              {agendaDays.length ? (
                agendaDays.map(({ day, items }) => (
                  <div key={dateKey(day)} className="uc-agenda-day" data-today={dateKey(day) === todayKey}>
                    <div className="uc-agenda-date">
                      <span>{day.toLocaleDateString("en-PH", { weekday: "short" })}</span>
                      <strong>{day.getDate()}</strong>
                    </div>
                    <ul>
                      {items.map((item) => (
                        <li key={item.id}>
                          <button type="button" className={`uc-agenda-item ${toneClass(item.type)}`} onClick={() => setSelectedEvent(item)}>
                            <span className="uc-agenda-time">{item.allDay ? "All day" : timeText(item.startsAt)}</span>
                            <span className="uc-agenda-text">
                              <span className="uc-agenda-title">{item.title}</span>
                              <span className="uc-agenda-meta">
                                {prettyType(item.type)}
                                {item.location ? ` · ${item.location}` : ""}
                                {defenseStatus(item) ? ` · ${defenseStatus(item)}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="uc-empty">Nothing on the calendar this month.</p>
              )}
            </div>
          ) : (
            <>
              <div className="uc-dow" aria-hidden="true">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <span key={name}>{name}</span>)}
              </div>
              <div className="uc-grid" data-view={view}>
                {(view === "week" ? weekDays : days).map((day) => {
                  const key = dateKey(day);
                  const dayEvents = visibleOn(day);
                  const inMonth = view === "week" || day.getMonth() === cursor.getMonth();
                  const today = key === todayKey;
                  const past = key < todayKey;
                  const limit = view === "week" ? 8 : 3;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${day.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}${dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}` : ""}`}
                      onClick={() => setSelectedDay(day)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedDay(day);
                        }
                      }}
                      className="uc-day"
                      data-out={!inMonth}
                      data-today={today}
                      data-past={past}
                      data-weekend={day.getDay() === 0 || day.getDay() === 6}
                    >
                      <span className="uc-day-num">{day.getDate()}</span>
                      <span className="uc-day-dots" aria-hidden="true">
                        {dayEvents.slice(0, 3).map((item) => <i key={item.id} className={toneClass(item.type)} />)}
                      </span>
                      <div className="uc-day-events">
                        {dayEvents.slice(0, limit).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`uc-block ${toneClass(item.type)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEvent(item);
                            }}
                          >
                            {!item.allDay && <b>{timeText(item.startsAt)}</b>} {item.title}
                          </button>
                        ))}
                        {dayEvents.length > limit && (
                          <button
                            type="button"
                            className="uc-more"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDay(day);
                            }}
                          >
                            +{dayEvents.length - limit} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

      {selectedDay && (
        <DayOverviewDialog
          day={selectedDay}
          events={selectedDayEvents}
          options={options.data}
          onClose={() => setSelectedDay(null)}
          onOpenEvent={(calendarEvent) => {
            setSelectedDay(null);
            setSelectedEvent(calendarEvent);
          }}
          onCreateEvent={() => openComposer(selectedDay, "CONSULTATION")}
          onCreateAvailability={() => openComposer(selectedDay, "AVAILABILITY")}
        />
      )}

      {selectedEvent && (
        <EventDetailsDialog
          event={selectedEvent}
          cancelling={cancelEvent.isPending}
          cancelError={
            cancelEvent.isError
              ? (cancelEvent.error as any)?.message ||
                "The entry could not be cancelled."
              : ""
          }
          onClose={() => setSelectedEvent(null)}
          onEdit={() => openEdit(selectedEvent)}
          onCancel={() => {
            if (
              window.confirm(
                `Cancel “${selectedEvent.title}”? This removes it from active calendars.`,
              )
            )
              cancelEvent.mutate(selectedEvent.id);
          }}
        />
      )}

      {composerOpen && (
        <CalendarComposer
          form={form}
          options={options.data}
          editing={Boolean(editingEvent)}
          conflicts={conflicts}
          conflictsAcknowledged={conflictsAcknowledged}
          saving={saveEvent.isPending || checkingConflicts}
          error={composerError}
          onChange={updateForm}
          onAllDayChange={handleAllDayChange}
          onAcknowledgeConflicts={setConflictsAcknowledged}
          onClose={() => {
            setComposerOpen(false);
            setEditingEvent(null);
            setConflicts([]);
            setComposerError("");
            if (composerDay) setSelectedDay(composerDay);
          }}
          onSubmit={submitComposer}
        />
      )}
    </div>
  );
}

function DayOverviewDialog({
  day,
  events,
  options,
  onClose,
  onOpenEvent,
  onCreateEvent,
  onCreateAvailability,
}: {
  day: Date;
  events: CalendarEvent[];
  options?: CalendarOptions;
  onClose: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateEvent: () => void;
  onCreateAvailability: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid items-end overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-overview-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-modal)] sm:my-6 sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[var(--color-primary)]">
              Day overview
            </p>
            <h2
              id="day-overview-title"
              className="mt-1 text-xl font-black text-[var(--color-text-primary)]"
            >
              {day.toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Close
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {events.length ? (
            events.map((calendarEvent) => (
              <button
                key={calendarEvent.id}
                onClick={() => onOpenEvent(calendarEvent)}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/45"
              >
                <span
                  className={`rounded-lg border px-2 py-1 text-sm font-black ${COLORS[calendarEvent.type] || COLORS.OTHER}`}
                >
                  {prettyType(calendarEvent.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-[var(--color-text-primary)]">
                    {calendarEvent.title}
                  </strong>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {calendarEvent.allDay
                      ? "All day"
                      : `${timeText(calendarEvent.startsAt)}–${timeText(calendarEvent.endsAt)}`}
                  </span>
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            ))
          ) : (
            <div className="rounded-xl bg-slate-50 p-8 text-center dark:bg-white/5">
              <CalendarDays className="mx-auto text-slate-300" />
              <p className="mt-3 text-base font-bold text-slate-600 dark:text-slate-300">
                No events scheduled
              </p>
              <p className="mt-1 text-base text-slate-400">
                This date is currently clear.
              </p>
            </div>
          )}
        </div>
        {(options?.canCreate || options?.canManageAvailability) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5 dark:border-white/10">
            {options.canCreate && (
              <button
                onClick={onCreateEvent}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]"
              >
                <Plus size={15} />
                Add event
              </button>
            )}
            {options.canManageAvailability && (
              <button
                onClick={onCreateAvailability}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                <Clock3 size={15} />
                Set availability
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EventDetailsDialog({
  event,
  cancelling,
  cancelError,
  onClose,
  onEdit,
  onCancel,
}: {
  event: CalendarEvent;
  cancelling: boolean;
  cancelError: string;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid items-end overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={(click) => click.target === click.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-modal)] sm:my-6 sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-lg border px-2 py-1 text-xs font-black ${COLORS[event.type] || COLORS.OTHER}`}
              >
                {prettyType(event.type)}
              </span>
              {defenseStatus(event) && (
                <span className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-1 text-xs font-black text-[var(--color-text-secondary)]">
                  {defenseStatus(event)}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-black text-[var(--color-text-primary)]">
              {event.title}
            </h2>
            {event.creator && (
              <p className="mt-1 text-base text-slate-400">
                Added by {event.creator.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Close
          </button>
        </div>
        {event.description && (
          <p className="mt-4 whitespace-pre-wrap text-base leading-6 text-slate-600 dark:text-slate-300">
            {event.description}
          </p>
        )}
        <div className="mt-5 space-y-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <p className="flex gap-2">
            <Clock3
              size={16}
              className="shrink-0 text-[var(--color-primary)]"
            />
            {event.allDay
              ? allDayText(event)
              : `${new Date(event.startsAt).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })} – ${new Date(event.endsAt).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })}`}
          </p>
          {event.availabilityStatus && (
            <p className="flex gap-2">
              <ShieldAlert
                size={16}
                className="shrink-0 text-[var(--color-primary)]"
              />
              {AVAILABILITY_LABELS[event.availabilityStatus]}
              {event.blocksScheduling ? " · Scheduling conflict enabled" : ""}
            </p>
          )}
          {event.location && (
            <p className="flex gap-2">
              <MapPin
                size={16}
                className="shrink-0 text-[var(--color-primary)]"
              />
              {event.location}
            </p>
          )}
          {event.groups.length > 0 && (
            <p className="flex gap-2">
              <Users
                size={16}
                className="shrink-0 text-[var(--color-primary)]"
              />
              {event.groups.map((group) => group.name).join(", ")}
            </p>
          )}
          {event.participantNames.length > 1 && (
            <p className="flex gap-2">
              <Users
                size={16}
                className="shrink-0 text-[var(--color-primary)]"
              />
              {event.participantNames.join(", ")}
            </p>
          )}
        </div>
        {event.privateNotes && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-black uppercase tracking-wider text-amber-800">
              Private administrative note
            </p>
            <p className="mt-1 whitespace-pre-wrap text-base leading-5 text-amber-900">
              {event.privateNotes}
            </p>
          </div>
        )}
        {cancelError && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-base font-bold text-rose-700">
            {cancelError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {event.actionUrl && (
            <Link
              to={event.actionUrl}
              className="inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-[var(--college-on-primary)] hover:bg-[var(--color-primary-dark)] dark:text-[var(--college-on-primary-dark)]"
            >
              Open defense workspace
            </Link>
          )}
          {event.meetingUrl && (
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-[var(--color-primary)]/30 px-4 py-2.5 text-sm font-black text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
            >
              Join online meeting
            </a>
          )}
          {event.canEdit && event.source === "CALENDAR" && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 dark:border-white/15 dark:text-slate-200"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {event.canEdit && event.source === "CALENDAR" && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-black text-rose-700 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {cancelling ? "Cancelling…" : "Cancel entry"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function CalendarComposer({
  form,
  options,
  editing,
  conflicts,
  conflictsAcknowledged,
  saving,
  error,
  onChange,
  onAllDayChange,
  onAcknowledgeConflicts,
  onClose,
  onSubmit,
}: {
  form: CalendarForm;
  options?: CalendarOptions;
  editing: boolean;
  conflicts: AvailabilityConflict[];
  conflictsAcknowledged: boolean;
  saving: boolean;
  error: string;
  onChange: (patch: Partial<CalendarForm>) => void;
  onAllDayChange: (value: boolean) => void;
  onAcknowledgeConflicts: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const isAvailability = form.type === "AVAILABILITY";
  const standardTypes: CalendarEventType[] = [
    "CONSULTATION",
    "DEFENSE",
    "DEADLINE",
    "MILESTONE",
    "ACADEMIC",
    "ANNOUNCEMENT",
    "OTHER",
  ];
  const availableTypes = [
    ...(options?.canCreate ? standardTypes : []),
    ...(options?.canManageAvailability ? ["AVAILABILITY" as const] : []),
  ];
  return (
    <div className="fixed inset-0 z-[110] grid items-end overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form
        onSubmit={onSubmit}
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-modal)] sm:my-6 sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[var(--color-primary)]">
              {editing ? "Edit calendar entry" : "New calendar entry"}
            </p>
            <h2 className="mt-1 text-xl font-black text-[var(--color-text-primary)]">
              {isAvailability
                ? "Set your availability"
                : "Schedule the right audience"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-slate-400"
          >
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Entry type
            <select
              value={form.type}
              onChange={(event) => {
                const type = event.target.value as CalendarEventType;
                onChange({
                  type,
                  title: type === "AVAILABILITY" ? "Unavailable" : "",
                  allDay: type === "AVAILABILITY",
                  blocksScheduling: type === "AVAILABILITY",
                });
              }}
              className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {prettyType(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Visibility
            <select
              value={form.visibility}
              onChange={(event) => onChange({ visibility: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              <option value="PARTICIPANTS">
                {isAvailability ? "Only me" : "Selected groups and people"}
              </option>
              <option value="PROGRAM">My department/program</option>
              <option value="COLLEGE">My college</option>
              {options?.canManageAll && (
                <option value="INSTITUTION">Entire institution</option>
              )}
            </select>
          </label>
          {isAvailability ? (
            <label className="sm:col-span-2 text-sm font-bold">
              Availability status
              <select
                value={form.availabilityStatus}
                onChange={(event) =>
                  onChange({
                    availabilityStatus: event.target
                      .value as AvailabilityStatus,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
              >
                {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="sm:col-span-2 text-sm font-bold">
              Title
              <input
                required
                value={form.title}
                onChange={(event) => onChange({ title: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
              />
            </label>
          )}
          <label className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold dark:bg-white/5">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(event) => onAllDayChange(event.target.checked)}
            />
            All-day entry
          </label>
          <label className="text-sm font-bold">
            Starts
            <input
              required
              type={form.allDay ? "date" : "datetime-local"}
              value={form.startsAt}
              onChange={(event) => onChange({ startsAt: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
            />
          </label>
          <label className="text-sm font-bold">
            {form.allDay ? "Ends on" : "Ends"}
            <input
              required
              type={form.allDay ? "date" : "datetime-local"}
              value={form.endsAt}
              onChange={(event) => onChange({ endsAt: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
            />
          </label>
          {!isAvailability && (
            <label className="sm:col-span-2 text-sm font-bold">
              Location or meeting details
              <input
                value={form.location}
                onChange={(event) => onChange({ location: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
              />
            </label>
          )}
          <label className="sm:col-span-2 text-sm font-bold">
            {isAvailability ? "Public message" : "Description"}
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder={
                isAvailability
                  ? "Example: Unavailable during this period. Please contact the office for urgent matters."
                  : "Add the complete event instructions or context."
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
            />
          </label>
          {isAvailability && (
            <label className="sm:col-span-2 text-sm font-bold">
              Private administrative note{" "}
              <span className="font-normal text-slate-400">
                (only you and authorized calendar managers)
              </span>
              <textarea
                rows={2}
                value={form.privateNotes}
                onChange={(event) =>
                  onChange({ privateNotes: event.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10"
              />
            </label>
          )}
          {isAvailability && (
            <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={form.blocksScheduling}
                onChange={(event) =>
                  onChange({ blocksScheduling: event.target.checked })
                }
              />
              <span>
                Warn schedulers about conflicts during this period.
                <span className="mt-0.5 block font-normal">
                  The warning can be acknowledged when an authorized user must
                  continue.
                </span>
              </span>
            </label>
          )}
        </div>
        {!isAvailability && form.visibility === "PARTICIPANTS" && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SelectionList
              title="Research groups"
              items={(options?.groups || []).map((item) => ({
                id: item.id,
                label: item.name,
                meta: item.programCode,
              }))}
              selected={form.researchIds}
              onChange={(researchIds) => onChange({ researchIds })}
            />
            <SelectionList
              title="Additional people"
              items={(options?.people || []).map((item) => ({
                id: item.id,
                label: item.name,
                meta: item.roles.join(", "),
              }))}
              selected={form.participantIds}
              onChange={(participantIds) => onChange({ participantIds })}
            />
          </div>
        )}
        {conflicts.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex gap-2">
              <ShieldAlert className="shrink-0 text-amber-700" size={18} />
              <div>
                <p className="text-base font-black text-amber-900">
                  Availability conflict detected
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  {conflicts.map((conflict) => (
                    <li key={conflict.eventId}>
                      {conflict.name} is marked{" "}
                      {AVAILABILITY_LABELS[conflict.status].toLowerCase()}{" "}
                      during this schedule.
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-start gap-2 text-sm font-bold text-amber-900">
                  <input
                    className="mt-0.5"
                    type="checkbox"
                    checked={conflictsAcknowledged}
                    onChange={(event) =>
                      onAcknowledgeConflicts(event.target.checked)
                    }
                  />
                  I reviewed the conflict and want to continue.
                </label>
              </div>
            </div>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-base font-bold text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            disabled={
              saving || (conflicts.length > 0 && !conflictsAcknowledged)
            }
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-black text-[var(--college-on-primary)] disabled:opacity-50 dark:text-[var(--college-on-primary-dark)]"
          >
            {saving
              ? "Saving…"
              : conflicts.length > 0
                ? "Schedule anyway"
                : editing
                  ? "Save changes"
                  : isAvailability
                    ? "Save availability"
                    : "Schedule event"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SelectionList({
  title,
  items,
  selected,
  onChange,
}: {
  title: string;
  items: { id: string; label: string; meta?: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold">{title}</legend>
      <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">
        {items.length ? (
          items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
                className="mt-0.5"
              />
              <span>
                <span className="block font-bold text-slate-700 dark:text-slate-200">
                  {item.label}
                </span>
                {item.meta && (
                  <span className="text-xs text-slate-400">{item.meta}</span>
                )}
              </span>
            </label>
          ))
        ) : (
          <p className="p-3 text-center text-base text-slate-400">
            No available options
          </p>
        )}
      </div>
    </fieldset>
  );
}
