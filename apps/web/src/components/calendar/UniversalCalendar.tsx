"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { CalendarSkeleton } from "@/components/ui/Skeleton";

type CalendarEvent = {
  id: string;
  source: string;
  type: "ACADEMIC" | "CONSULTATION" | "DEFENSE" | "DEADLINE" | "MILESTONE" | "ANNOUNCEMENT" | "OTHER";
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
  meetingUrl?: string | null;
  visibility: string;
  program?: { code: string; name: string } | null;
  groups: { id: string; name: string }[];
  participantNames: string[];
  status?: string;
};

const COLORS: Record<string, string> = {
  CONSULTATION: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200",
  DEFENSE: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  DEADLINE: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  MILESTONE: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200",
  ACADEMIC: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  ANNOUNCEMENT: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200",
  OTHER: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
};

const TZ = "Asia/Manila";
const dateKey = (date: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const timeText = (date: string) => new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(date));

export default function UniversalCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", type: "CONSULTATION", visibility: "PARTICIPANTS", startsAt: "", endsAt: "", location: "", description: "", researchIds: [] as string[], participantIds: [] as string[] });
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(monthEnd); gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const calendar = useQuery({
    queryKey: ["universal-calendar", gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: () => apiClient.get<{ events: CalendarEvent[]; scope: { panelistRestricted: boolean } }>("/api/calendar", { params: { start: gridStart.toISOString(), end: gridEnd.toISOString() } }),
  });
  const options = useQuery({
    queryKey: ["calendar-options"],
    queryFn: () => apiClient.get<{ canCreate: boolean; groups: { id: string; name: string; programCode: string }[]; people: { id: string; name: string; programCode?: string; roles: string[] }[] }>("/api/calendar/options"),
  });
  const createEvent = useMutation({
    mutationFn: () => apiClient.post("/api/calendar", { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }),
    onSuccess: async () => { setShowCreate(false); setForm({ title: "", type: "CONSULTATION", visibility: "PARTICIPANTS", startsAt: "", endsAt: "", location: "", description: "", researchIds: [], participantIds: [] }); await queryClient.invalidateQueries({ queryKey: ["universal-calendar"] }); },
  });
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of calendar.data?.events || []) {
      const key = dateKey(event.startsAt);
      grouped.set(key, [...(grouped.get(key) || []), event]);
    }
    return grouped;
  }, [calendar.data]);
  const days = Array.from({ length: Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) }, (_, index) => {
    const day = new Date(gridStart); day.setDate(day.getDate() + index); return day;
  });
  const upcoming = (calendar.data?.events || []).filter((event) => new Date(event.endsAt) >= new Date()).slice(0, 6);
  const isPanelist = user?.roles.includes("PANELIST") && calendar.data?.scope.panelistRestricted;

  if (calendar.isLoading) return <CalendarSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl bg-[#0B3A53] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.22em] text-[#ffb21c]">Universal Calendar</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Your complete Advisio schedule</h1><p className="mt-2 max-w-3xl text-sm text-slate-200">Consultations, defenses, deadlines, and academic events are combined here while keeping group and participant schedules private.</p></div>
          <div className="flex flex-wrap items-center gap-3"><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold backdrop-blur"><span className="block text-[#ffcf70]">Current scope</span>{isPanelist ? "Only defenses and events that include you" : user?.program?.name || user?.college?.name || "Institution events assigned to you"}</div>{options.data?.canCreate && <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#ffb21c] px-4 py-3 text-xs font-black text-[#0B3A53] hover:bg-[#ffc34d]"><Plus size={16} />Add event</button>}</div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b2b]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10 sm:px-5">
            <div className="flex items-center gap-3"><CalendarDays className="text-[#C98B00]" size={22} /><div><h2 className="font-black text-slate-900 dark:text-white">{cursor.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</h2><p className="text-[11px] font-semibold text-slate-400">Times shown in Philippine Time</p></div></div>
            <div className="flex items-center gap-2"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5" aria-label="Previous month"><ChevronLeft size={18} /></button><button onClick={() => setCursor(new Date())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Today</button><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5" aria-label="Next month"><ChevronRight size={18} /></button></div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-white/[.03]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">{day}</div>)}</div>
          {calendar.isLoading ? <div className="grid min-h-[520px] place-items-center text-sm font-semibold text-slate-400">Loading your schedule…</div> : calendar.isError ? <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm font-semibold text-rose-600">The calendar could not be loaded. Please try again.</div> : <div className="grid grid-cols-7">{days.map((day) => { const key = dateKey(day); const dayEvents = eventsByDay.get(key) || []; const inMonth = day.getMonth() === cursor.getMonth(); const today = key === dateKey(new Date()); return <div key={key} className={`min-h-[112px] border-b border-r border-slate-100 p-1.5 dark:border-white/5 ${inMonth ? "bg-white dark:bg-[#101b2b]" : "bg-slate-50/60 dark:bg-black/10"}`}><div className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${today ? "bg-[#0B3A53] text-white ring-2 ring-[#ffb21c]/40" : inMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}>{day.getDate()}</div><div className="space-y-1">{dayEvents.slice(0, 3).map((event) => <button key={event.id} onClick={() => setSelected(event)} className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[9px] font-bold ${COLORS[event.type] || COLORS.OTHER}`}>{event.allDay ? "" : `${timeText(event.startsAt)} `}{event.title}</button>)}{dayEvents.length > 3 && <p className="px-1 text-[9px] font-bold text-slate-400">+{dayEvents.length - 3} more</p>}</div></div>; })}</div>}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b2b]"><h2 className="font-black text-slate-900 dark:text-white">Upcoming</h2><p className="mt-1 text-xs text-slate-400">Your next assigned events</p><div className="mt-4 space-y-3">{upcoming.length ? upcoming.map((event) => <button key={event.id} onClick={() => setSelected(event)} className="w-full rounded-xl border border-slate-100 p-3 text-left hover:border-[#C9A227]/50 hover:bg-amber-50/30 dark:border-white/10 dark:hover:bg-white/5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-black text-slate-800 dark:text-white">{event.title}</p><span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black ${COLORS[event.type] || COLORS.OTHER}`}>{event.type}</span></div><p className="mt-2 text-[11px] font-semibold text-slate-500">{new Date(event.startsAt).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" })} · {timeText(event.startsAt)}</p></button>) : <div className="rounded-xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-400 dark:bg-white/5">No upcoming events in this period.</div>}</div></aside>
      </div>

      {selected && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && setSelected(null)}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]"><div className="flex items-start justify-between gap-4"><div><span className={`inline-flex rounded-lg border px-2 py-1 text-[9px] font-black ${COLORS[selected.type] || COLORS.OTHER}`}>{selected.type}</span><h2 className="mt-3 text-xl font-black text-slate-900 dark:text-white">{selected.title}</h2></div><button onClick={() => setSelected(null)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">Close</button></div>{selected.description && <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.description}</p>}<div className="mt-5 space-y-3 text-xs font-semibold text-slate-600 dark:text-slate-300"><p className="flex gap-2"><Clock3 size={16} className="text-[#C98B00]" />{new Date(selected.startsAt).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" })} – {timeText(selected.endsAt)}</p>{selected.location && <p className="flex gap-2"><MapPin size={16} className="text-[#C98B00]" />{selected.location}</p>}{selected.groups.length > 0 && <p className="flex gap-2"><Users size={16} className="text-[#C98B00]" />{selected.groups.map((group) => group.name).join(", ")}</p>}</div>{selected.meetingUrl && <a href={selected.meetingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-xl bg-[#0B3A53] px-4 py-2.5 text-xs font-black text-white hover:bg-[#0E4968]">Open meeting</a>}</section></div>}
      {showCreate && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={(event) => { event.preventDefault(); createEvent.mutate(); }} className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#C98B00]">New calendar event</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Schedule the right audience</h2></div><button type="button" onClick={() => setShowCreate(false)} className="text-xs font-bold text-slate-400">Close</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-xs font-bold">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label><label className="text-xs font-bold">Event type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#101b2b]">{["CONSULTATION", "DEFENSE", "DEADLINE", "MILESTONE", "ACADEMIC", "ANNOUNCEMENT", "OTHER"].map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-xs font-bold">Visibility<select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#101b2b]"><option value="PARTICIPANTS">Selected groups and people</option><option value="PROGRAM">My department/program</option><option value="COLLEGE">My college</option></select></label><label className="text-xs font-bold">Starts<input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label><label className="text-xs font-bold">Ends<input required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label><label className="sm:col-span-2 text-xs font-bold">Location or meeting details<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label><label className="sm:col-span-2 text-xs font-bold">Description<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label></div>{form.visibility === "PARTICIPANTS" && <div className="mt-5 grid gap-4 sm:grid-cols-2"><SelectionList title="Research groups" items={(options.data?.groups || []).map((item) => ({ id: item.id, label: item.name, meta: item.programCode }))} selected={form.researchIds} onChange={(researchIds) => setForm({ ...form, researchIds })} /><SelectionList title="Additional people" items={(options.data?.people || []).map((item) => ({ id: item.id, label: item.name, meta: item.roles.join(", ") }))} selected={form.participantIds} onChange={(participantIds) => setForm({ ...form, participantIds })} /></div>}{createEvent.isError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{createEvent.error instanceof Error ? createEvent.error.message : "Could not create the event."}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-white/10">Cancel</button><button disabled={createEvent.isPending} className="rounded-xl bg-[#0B3A53] px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{createEvent.isPending ? "Scheduling…" : "Schedule event"}</button></div></form></div>}
    </div>
  );
}

function SelectionList({ title, items, selected, onChange }: { title: string; items: { id: string; label: string; meta?: string }[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="text-xs font-bold">{title}</legend><div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">{items.length ? items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} className="mt-0.5" /><span><span className="block font-bold text-slate-700 dark:text-slate-200">{item.label}</span>{item.meta && <span className="text-[9px] text-slate-400">{item.meta}</span>}</span></label>) : <p className="p-3 text-center text-[10px] text-slate-400">No available options</p>}</div></fieldset>;
}
