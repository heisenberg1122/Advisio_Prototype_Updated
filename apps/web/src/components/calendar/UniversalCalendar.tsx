"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus, ShieldAlert, Trash2, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { CalendarSkeleton } from "@/components/ui/Skeleton";

type CalendarEventType = "ACADEMIC" | "CONSULTATION" | "DEFENSE" | "DEADLINE" | "MILESTONE" | "ANNOUNCEMENT" | "AVAILABILITY" | "OTHER";
type AvailabilityStatus = "UNAVAILABLE" | "ON_LEAVE" | "OUT_OF_OFFICE" | "LIMITED_AVAILABILITY";

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
  CONSULTATION: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200",
  DEFENSE: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  DEADLINE: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  MILESTONE: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200",
  ACADEMIC: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  ANNOUNCEMENT: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200",
  AVAILABILITY: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  OTHER: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
};

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  UNAVAILABLE: "Unavailable",
  ON_LEAVE: "On leave",
  OUT_OF_OFFICE: "Out of office",
  LIMITED_AVAILABILITY: "Limited availability",
};

const TZ = "Asia/Manila";
const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDateTime = (date: Date) => `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const dateKey = (date: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const timeText = (date: string) => new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(date));
const prettyType = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const allDayText = (event: CalendarEvent) => {
  const start = new Date(event.startsAt);
  const inclusiveEnd = new Date(new Date(event.endsAt).getTime() - 1);
  const startText = start.toLocaleDateString("en-PH", { timeZone: TZ, dateStyle: "medium" });
  const endText = inclusiveEnd.toLocaleDateString("en-PH", { timeZone: TZ, dateStyle: "medium" });
  return startText === endText ? `${startText} · All day` : `${startText} – ${endText} · All day`;
};

function formForDate(day: Date, type: CalendarEventType): CalendarForm {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), type === "AVAILABILITY" ? 0 : 9, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), type === "AVAILABILITY" ? 0 : 10, 0);
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
    startsAt: event.allDay ? dateKey(event.startsAt) : localDateTime(new Date(event.startsAt)),
    endsAt: event.allDay ? dateKey(endForAllDay) : localDateTime(new Date(event.endsAt)),
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
    return { startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() };
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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [composerDay, setComposerDay] = useState<Date | null>(null);
  const [form, setForm] = useState<CalendarForm>(() => formForDate(new Date(), "CONSULTATION"));
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
  const days = useMemo(() => Array.from({ length: Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + index);
    return day;
  }), [gridStart.getTime(), gridEnd.getTime()]);

  const calendar = useQuery({
    queryKey: ["universal-calendar", gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: () => apiClient.get<{ events: CalendarEvent[]; scope: { panelistRestricted: boolean } }>("/api/calendar", { params: { start: gridStart.toISOString(), end: gridEnd.toISOString() } }),
  });
  const options = useQuery({
    queryKey: ["calendar-options"],
    queryFn: () => apiClient.get<CalendarOptions>("/api/calendar/options"),
  });

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      grouped.set(dateKey(day), (calendar.data?.events || [])
        .filter((event) => new Date(event.startsAt) < end && new Date(event.endsAt) > start)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    }
    return grouped;
  }, [calendar.data, days]);

  const upcoming = (calendar.data?.events || []).filter((event) => new Date(event.endsAt) >= new Date()).slice(0, 6);
  const isPanelist = user?.roles.includes("PANELIST") && calendar.data?.scope.panelistRestricted;
  const canSchedule = Boolean(options.data?.canCreate || options.data?.canManageAvailability);
  const selectedDayEvents = selectedDay ? eventsByDay.get(dateKey(selectedDay)) || [] : [];

  const saveEvent = useMutation({
    mutationFn: (payload: Record<string, unknown>) => editingEvent
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
    onError: (error: any) => setComposerError(error?.message || "The calendar entry could not be saved."),
  });

  const cancelEvent = useMutation({
    mutationFn: (eventId: string) => apiClient.delete(`/api/calendar/${eventId}`),
    onSuccess: async () => {
      setSelectedEvent(null);
      await queryClient.invalidateQueries({ queryKey: ["universal-calendar"] });
    },
  });

  const openComposer = (day: Date, type?: CalendarEventType) => {
    const defaultType = type || (options.data?.canCreate ? "CONSULTATION" : "AVAILABILITY");
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
      updateForm({ allDay, startsAt: form.startsAt.slice(0, 10), endsAt: form.endsAt.slice(0, 10) });
    } else {
      updateForm({ allDay, startsAt: `${form.startsAt.slice(0, 10)}T09:00`, endsAt: `${form.endsAt.slice(0, 10)}T10:00` });
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
        const response = await apiClient.post<{ conflicts: AvailabilityConflict[] }>("/api/calendar/conflicts", {
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
        setComposerError(error?.message || "Availability could not be checked.");
        setCheckingConflicts(false);
        return;
      }
      setCheckingConflicts(false);
    }

    saveEvent.mutate({
      ...form,
      ...schedule,
      title: form.type === "AVAILABILITY" ? AVAILABILITY_LABELS[form.availabilityStatus] : form.title,
    });
  };

  if (calendar.isLoading) return <CalendarSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl bg-[#0B3A53] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#ffb21c]">Universal Calendar</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Your complete Advisio schedule</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">Select a date to review its schedule. Authorized users can create events or mark availability from the day overview.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold backdrop-blur">
            <span className="block text-[#ffcf70]">Current scope</span>
            {isPanelist ? "Only defenses and events that include you" : user?.program?.name || user?.college?.name || "Institution events assigned to you"}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b2b]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10 sm:px-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-[#C98B00]" size={22} />
              <div>
                <h2 className="font-black text-slate-900 dark:text-white">{cursor.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</h2>
                <p className="text-[11px] font-semibold text-slate-400">Times shown in Philippine Time{canSchedule ? " · Select a date to add an entry" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5" aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button onClick={() => setCursor(new Date())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Today</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5" aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[.03]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">{day}</div>)}
          </div>
          {calendar.isError ? (
            <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm font-semibold text-rose-600">The calendar could not be loaded. Please try again.</div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDay.get(key) || [];
                const inMonth = day.getMonth() === cursor.getMonth();
                const today = key === dateKey(new Date());
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${day.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`}
                    onClick={() => setSelectedDay(day)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDay(day);
                      }
                    }}
                    className={`group min-h-[112px] cursor-pointer border-b border-r border-slate-100 p-1.5 outline-none transition hover:bg-amber-50/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C98B00] dark:border-white/5 dark:hover:bg-white/5 ${inMonth ? "bg-white dark:bg-[#101b2b]" : "bg-slate-50/60 dark:bg-black/10"}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${today ? "bg-[#0B3A53] text-white ring-2 ring-[#ffb21c]/40" : inMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}>{day.getDate()}</span>
                      <span className="hidden text-[8px] font-bold text-[#9A6A00] group-hover:inline">View day</span>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((calendarEvent) => (
                        <button
                          key={calendarEvent.id}
                          onClick={(event) => { event.stopPropagation(); setSelectedEvent(calendarEvent); }}
                          className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[9px] font-bold ${COLORS[calendarEvent.type] || COLORS.OTHER}`}
                        >
                          {calendarEvent.allDay ? "" : `${timeText(calendarEvent.startsAt)} `}{calendarEvent.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && <button onClick={(event) => { event.stopPropagation(); setSelectedDay(day); }} className="px-1 text-[9px] font-bold text-slate-500 hover:text-[#0B3A53]">+{dayEvents.length - 3} more</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b2b]">
          <h2 className="font-black text-slate-900 dark:text-white">Upcoming</h2>
          <p className="mt-1 text-xs text-slate-400">Your next assigned events</p>
          <div className="mt-4 space-y-3">
            {upcoming.length ? upcoming.map((calendarEvent) => (
              <button key={calendarEvent.id} onClick={() => setSelectedEvent(calendarEvent)} className="w-full rounded-xl border border-slate-100 p-3 text-left hover:border-[#C9A227]/50 hover:bg-amber-50/30 dark:border-white/10 dark:hover:bg-white/5">
                <div className="flex items-start justify-between gap-2"><p className="text-xs font-black text-slate-800 dark:text-white">{calendarEvent.title}</p><span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black ${COLORS[calendarEvent.type] || COLORS.OTHER}`}>{prettyType(calendarEvent.type)}</span></div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">{new Date(calendarEvent.startsAt).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" })}{calendarEvent.allDay ? " · All day" : ` · ${timeText(calendarEvent.startsAt)}`}</p>
              </button>
            )) : <div className="rounded-xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-400 dark:bg-white/5">No upcoming events in this period.</div>}
          </div>
        </aside>
      </div>

      {selectedDay && (
        <DayOverviewDialog
          day={selectedDay}
          events={selectedDayEvents}
          options={options.data}
          onClose={() => setSelectedDay(null)}
          onOpenEvent={(calendarEvent) => { setSelectedDay(null); setSelectedEvent(calendarEvent); }}
          onCreateEvent={() => openComposer(selectedDay, "CONSULTATION")}
          onCreateAvailability={() => openComposer(selectedDay, "AVAILABILITY")}
        />
      )}

      {selectedEvent && (
        <EventDetailsDialog
          event={selectedEvent}
          cancelling={cancelEvent.isPending}
          cancelError={cancelEvent.isError ? (cancelEvent.error as any)?.message || "The entry could not be cancelled." : ""}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => openEdit(selectedEvent)}
          onCancel={() => {
            if (window.confirm(`Cancel “${selectedEvent.title}”? This removes it from active calendars.`)) cancelEvent.mutate(selectedEvent.id);
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
          onClose={() => { setComposerOpen(false); setEditingEvent(null); setConflicts([]); setComposerError(""); if (composerDay) setSelectedDay(composerDay); }}
          onSubmit={submitComposer}
        />
      )}
    </div>
  );
}

function DayOverviewDialog({ day, events, options, onClose, onOpenEvent, onCreateEvent, onCreateAvailability }: {
  day: Date;
  events: CalendarEvent[];
  options?: CalendarOptions;
  onClose: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateEvent: () => void;
  onCreateAvailability: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="day-overview-title" className="my-6 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-[#C98B00]">Day overview</p><h2 id="day-overview-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{day.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2></div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">Close</button>
        </div>
        <div className="mt-5 space-y-2">
          {events.length ? events.map((calendarEvent) => (
            <button key={calendarEvent.id} onClick={() => onOpenEvent(calendarEvent)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#C98B00] hover:bg-amber-50/30 dark:border-white/10 dark:hover:bg-white/5">
              <span className={`rounded-lg border px-2 py-1 text-[9px] font-black ${COLORS[calendarEvent.type] || COLORS.OTHER}`}>{prettyType(calendarEvent.type)}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800 dark:text-white">{calendarEvent.title}</strong><span className="mt-0.5 block text-xs text-slate-500">{calendarEvent.allDay ? "All day" : `${timeText(calendarEvent.startsAt)}–${timeText(calendarEvent.endsAt)}`}</span></span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          )) : <div className="rounded-xl bg-slate-50 p-8 text-center dark:bg-white/5"><CalendarDays className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">No events scheduled</p><p className="mt-1 text-xs text-slate-400">This date is currently clear.</p></div>}
        </div>
        {(options?.canCreate || options?.canManageAvailability) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5 dark:border-white/10">
            {options.canCreate && <button onClick={onCreateEvent} className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-2.5 text-xs font-black text-white"><Plus size={15} />Add event</button>}
            {options.canManageAvailability && <button onClick={onCreateAvailability} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 dark:border-white/15 dark:text-slate-200"><Clock3 size={15} />Set availability</button>}
          </div>
        )}
      </section>
    </div>
  );
}

function EventDetailsDialog({ event, cancelling, cancelError, onClose, onEdit, onCancel }: {
  event: CalendarEvent;
  cancelling: boolean;
  cancelError: string;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onClick={(click) => click.target === click.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" className="my-6 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]">
        <div className="flex items-start justify-between gap-4">
          <div><span className={`inline-flex rounded-lg border px-2 py-1 text-[9px] font-black ${COLORS[event.type] || COLORS.OTHER}`}>{prettyType(event.type)}</span><h2 className="mt-3 text-xl font-black text-slate-900 dark:text-white">{event.title}</h2>{event.creator && <p className="mt-1 text-xs text-slate-400">Added by {event.creator.name}</p>}</div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">Close</button>
        </div>
        {event.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{event.description}</p>}
        <div className="mt-5 space-y-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <p className="flex gap-2"><Clock3 size={16} className="shrink-0 text-[#C98B00]" />{event.allDay ? allDayText(event) : `${new Date(event.startsAt).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })} – ${new Date(event.endsAt).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })}`}</p>
          {event.availabilityStatus && <p className="flex gap-2"><ShieldAlert size={16} className="shrink-0 text-[#C98B00]" />{AVAILABILITY_LABELS[event.availabilityStatus]}{event.blocksScheduling ? " · Scheduling conflict enabled" : ""}</p>}
          {event.location && <p className="flex gap-2"><MapPin size={16} className="shrink-0 text-[#C98B00]" />{event.location}</p>}
          {event.groups.length > 0 && <p className="flex gap-2"><Users size={16} className="shrink-0 text-[#C98B00]" />{event.groups.map((group) => group.name).join(", ")}</p>}
          {event.participantNames.length > 1 && <p className="flex gap-2"><Users size={16} className="shrink-0 text-[#C98B00]" />{event.participantNames.join(", ")}</p>}
        </div>
        {event.privateNotes && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Private administrative note</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-amber-900">{event.privateNotes}</p></div>}
        {cancelError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{cancelError}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {event.meetingUrl && <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-[#0B3A53] px-4 py-2.5 text-xs font-black text-white hover:bg-[#0E4968]">Open meeting</a>}
          {event.canEdit && event.source === "CALENDAR" && <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 dark:border-white/15 dark:text-slate-200"><Pencil size={14} />Edit</button>}
          {event.canEdit && event.source === "CALENDAR" && <button onClick={onCancel} disabled={cancelling} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50"><Trash2 size={14} />{cancelling ? "Cancelling…" : "Cancel entry"}</button>}
        </div>
      </section>
    </div>
  );
}

function CalendarComposer({ form, options, editing, conflicts, conflictsAcknowledged, saving, error, onChange, onAllDayChange, onAcknowledgeConflicts, onClose, onSubmit }: {
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
  const standardTypes: CalendarEventType[] = ["CONSULTATION", "DEFENSE", "DEADLINE", "MILESTONE", "ACADEMIC", "ANNOUNCEMENT", "OTHER"];
  const availableTypes = [...(options?.canCreate ? standardTypes : []), ...(options?.canManageAvailability ? ["AVAILABILITY" as const] : [])];
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-[#C98B00]">{editing ? "Edit calendar entry" : "New calendar entry"}</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{isAvailability ? "Set your availability" : "Schedule the right audience"}</h2></div>
          <button type="button" onClick={onClose} className="text-xs font-bold text-slate-400">Close</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold">Entry type<select value={form.type} onChange={(event) => { const type = event.target.value as CalendarEventType; onChange({ type, title: type === "AVAILABILITY" ? "Unavailable" : "", allDay: type === "AVAILABILITY", blocksScheduling: type === "AVAILABILITY" }); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#101b2b]">{availableTypes.map((type) => <option key={type} value={type}>{prettyType(type)}</option>)}</select></label>
          <label className="text-xs font-bold">Visibility<select value={form.visibility} onChange={(event) => onChange({ visibility: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#101b2b]"><option value="PARTICIPANTS">{isAvailability ? "Only me" : "Selected groups and people"}</option><option value="PROGRAM">My department/program</option><option value="COLLEGE">My college</option>{options?.canManageAll && <option value="INSTITUTION">Entire institution</option>}</select></label>
          {isAvailability ? (
            <label className="sm:col-span-2 text-xs font-bold">Availability status<select value={form.availabilityStatus} onChange={(event) => onChange({ availabilityStatus: event.target.value as AvailabilityStatus })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#101b2b]">{Object.entries(AVAILABILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          ) : (
            <label className="sm:col-span-2 text-xs font-bold">Title<input required value={form.title} onChange={(event) => onChange({ title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
          )}
          <label className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold dark:bg-white/5"><input type="checkbox" checked={form.allDay} onChange={(event) => onAllDayChange(event.target.checked)} />All-day entry</label>
          <label className="text-xs font-bold">Starts<input required type={form.allDay ? "date" : "datetime-local"} value={form.startsAt} onChange={(event) => onChange({ startsAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
          <label className="text-xs font-bold">{form.allDay ? "Ends on" : "Ends"}<input required type={form.allDay ? "date" : "datetime-local"} value={form.endsAt} onChange={(event) => onChange({ endsAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
          {!isAvailability && <label className="sm:col-span-2 text-xs font-bold">Location or meeting details<input value={form.location} onChange={(event) => onChange({ location: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>}
          <label className="sm:col-span-2 text-xs font-bold">{isAvailability ? "Public message" : "Description"}<textarea rows={3} value={form.description} onChange={(event) => onChange({ description: event.target.value })} placeholder={isAvailability ? "Example: Unavailable during this period. Please contact the office for urgent matters." : "Add the complete event instructions or context."} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
          {isAvailability && <label className="sm:col-span-2 text-xs font-bold">Private administrative note <span className="font-normal text-slate-400">(only you and authorized calendar managers)</span><textarea rows={2} value={form.privateNotes} onChange={(event) => onChange({ privateNotes: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>}
          {isAvailability && <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900"><input className="mt-0.5" type="checkbox" checked={form.blocksScheduling} onChange={(event) => onChange({ blocksScheduling: event.target.checked })} /><span>Warn schedulers about conflicts during this period.<span className="mt-0.5 block font-normal">The warning can be acknowledged when an authorized user must continue.</span></span></label>}
        </div>
        {!isAvailability && form.visibility === "PARTICIPANTS" && <div className="mt-5 grid gap-4 sm:grid-cols-2"><SelectionList title="Research groups" items={(options?.groups || []).map((item) => ({ id: item.id, label: item.name, meta: item.programCode }))} selected={form.researchIds} onChange={(researchIds) => onChange({ researchIds })} /><SelectionList title="Additional people" items={(options?.people || []).map((item) => ({ id: item.id, label: item.name, meta: item.roles.join(", ") }))} selected={form.participantIds} onChange={(participantIds) => onChange({ participantIds })} /></div>}
        {conflicts.length > 0 && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="flex gap-2"><ShieldAlert className="shrink-0 text-amber-700" size={18} /><div><p className="text-xs font-black text-amber-900">Availability conflict detected</p><ul className="mt-2 space-y-1 text-xs text-amber-900">{conflicts.map((conflict) => <li key={conflict.eventId}>{conflict.name} is marked {AVAILABILITY_LABELS[conflict.status].toLowerCase()} during this schedule.</li>)}</ul><label className="mt-3 flex items-start gap-2 text-xs font-bold text-amber-900"><input className="mt-0.5" type="checkbox" checked={conflictsAcknowledged} onChange={(event) => onAcknowledgeConflicts(event.target.checked)} />I reviewed the conflict and want to continue.</label></div></div></div>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-white/10">Cancel</button><button disabled={saving || (conflicts.length > 0 && !conflictsAcknowledged)} className="rounded-xl bg-[#0B3A53] px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? "Saving…" : conflicts.length > 0 ? "Schedule anyway" : editing ? "Save changes" : isAvailability ? "Save availability" : "Schedule event"}</button></div>
      </form>
    </div>
  );
}

function SelectionList({ title, items, selected, onChange }: { title: string; items: { id: string; label: string; meta?: string }[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="text-xs font-bold">{title}</legend><div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">{items.length ? items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} className="mt-0.5" /><span><span className="block font-bold text-slate-700 dark:text-slate-200">{item.label}</span>{item.meta && <span className="text-[9px] text-slate-400">{item.meta}</span>}</span></label>) : <p className="p-3 text-center text-[10px] text-slate-400">No available options</p>}</div></fieldset>;
}
