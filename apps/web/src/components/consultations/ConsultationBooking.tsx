import { useCallback, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";
import { useConsultationRecipients, useRefreshConsultations, type ConsultationProject } from "./ConsultationMeetingForm";

const inputClass = "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-[var(--color-primary)]";

export function ConsultationBooking({ projectId, projects = [] }: { projectId?: string; projects?: ConsultationProject[] }) {
  const refresh = useRefreshConsultations();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "");
  const [notice, setNotice] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState("");
  const [customTime, setCustomTime] = useState("");
  const advisers = useConsultationRecipients(selectedProjectId, { adviser: true, enabled: isOpen });
  const times = useQuery({
    queryKey: ["consultation-availability", selectedProjectId, adviserId, date, duration],
    enabled: isOpen && Boolean(selectedProjectId && adviserId && date),
    queryFn: () => apiClient.get<{ slots: string[] }>("/api/consultations/availability", {
      params: { researchId: selectedProjectId, adviserId, date, duration },
    }),
    refetchInterval: 15_000,
  });
  const close = useCallback(() => setIsOpen(false), []);
  const booking = useMutation({
    mutationFn: async (fields: FormData) => {
      if (!selectedProjectId) throw new Error("Select a research project first.");
      const title = String(fields.get("topic") ?? "").trim();
      if (!title) throw new Error("Enter a discussion topic.");
      const start = new Date(startTime === "custom" ? `${date}T${customTime}:00+08:00` : startTime);
      if (!Number.isFinite(+start) || +start <= Date.now() ||
          (startTime !== "custom" && !times.data?.slots.includes(startTime))) {
        throw new Error("Choose a consultation start time in the future.");
      }

      return apiClient.post("/api/consultations", {
        researchId: selectedProjectId,
        adviserId,
        title,
        description: fields.get("description"),
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(start.getTime() + duration * 60_000).toISOString(),
      });
    },
    onSuccess: () => {
      close();
      setNotice("Request sent. Awaiting adviser approval.");
      void refresh();
    },
    onError: () => { void times.refetch(); },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!booking.isPending) booking.mutate(new FormData(event.currentTarget));
  }

  return (
    <div className="min-w-0">
      <Button
        type="button"
        aria-haspopup="dialog"
        size="lg"
        className="w-full sm:w-auto"
        isLoading={booking.isPending}
        loadingText="Sending request..."
        onClick={() => {
          booking.reset();
          setNotice("");
          setIsOpen(true);
        }}
      >
        <span className="sm:hidden">Book session</span>
        <span className="hidden sm:inline">Book a Consultation Session</span>
      </Button>
      {notice && <p role="status" className="mt-2 text-sm text-[var(--color-text-secondary)]">{notice}</p>}
      <Modal
        isOpen={isOpen}
        onClose={() => { if (!booking.isPending) close(); }}
        title="Book a Consultation Session"
        subtitle="Your adviser will review and confirm the schedule."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
          {projects.length > 0 && <label className="flex flex-col gap-1 font-semibold">
            Research group
            <select required className={inputClass} value={selectedProjectId} onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setAdviserId("");
              setStartTime("");
            }}>
              <option value="">Choose a group</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}
            </select>
          </label>}
          <label className="flex flex-col gap-1 font-semibold">
            Assigned adviser
            <select value={adviserId} onChange={(event) => { setAdviserId(event.target.value); setStartTime(""); }} className={inputClass} required>
              <option value="">Choose an adviser</option>
              {advisers.data?.recipients.map((adviser) => <option key={adviser.id} value={adviser.id}>{adviser.name}</option>)}
            </select>
          </label>
          {advisers.isError && <p role="alert">{advisers.error.message}</p>}
          {advisers.isSuccess && !advisers.data.recipients.length && <p>No active adviser is assigned to this group.</p>}
          <label className="flex flex-col gap-1 font-semibold">
            Discussion topic
            <input name="topic" required maxLength={200} placeholder="e.g. Review Chapter 3" className={inputClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-semibold">
              Preferred date
              <input value={date} onChange={(event) => { setDate(event.target.value); setStartTime(""); }} type="date" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Duration
              <select value={duration} onChange={(event) => { setDuration(Number(event.target.value)); setStartTime(""); }} className={inputClass}>
                {[30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 font-semibold">
            Available start time
            <select className={inputClass} value={startTime} onChange={(event) => setStartTime(event.target.value)} required>
              <option value="">Choose a time</option>
              {times.data?.slots.map((slot) => <option key={slot} value={slot}>{new Date(slot).toLocaleTimeString("en-PH", {
                hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
              })}</option>)}
              {adviserId && date && <option value="custom">Request another time</option>}
            </select>
          </label>
          {startTime === "custom" && <label className="flex flex-col gap-1 font-semibold">
            Preferred start time
            <input type="time" value={customTime} onChange={(event) => setCustomTime(event.target.value)} className={inputClass} required />
          </label>}
          {adviserId && date && times.isPending && <p role="status">Checking Advisio bookings…</p>}
          {times.isSuccess && times.data.slots.length === 0 && <p>No suggested openings. Try another date or request a different time.</p>}
          {times.isError && <p role="alert">{times.error.message}</p>}
          <label className="flex flex-col gap-1 font-semibold">Description (optional)
            <textarea name="description" maxLength={5000} rows={3} className={inputClass} />
          </label>
          <p className="text-[var(--color-text-secondary)]">Times are in Philippine time. Openings are based on Advisio bookings and still need adviser approval.</p>
          {booking.error && <p role="alert" className="text-red-700 dark:text-red-300">{booking.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="lg" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" size="lg" isLoading={booking.isPending}
              disabled={startTime === "custom" ? !customTime : !times.data?.slots.includes(startTime)}>Send request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
