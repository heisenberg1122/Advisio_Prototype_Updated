import { useCallback, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
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
  const advisers = useConsultationRecipients(selectedProjectId, { adviser: true, enabled: isOpen });
  const close = useCallback(() => setIsOpen(false), []);
  const booking = useMutation({
    mutationFn: async (fields: FormData) => {
      if (!selectedProjectId) throw new Error("Select a research project first.");
      const title = String(fields.get("topic") ?? "").trim();
      if (!title) throw new Error("Enter a discussion topic.");
      const start = new Date(`${fields.get("date")}T${fields.get("time")}:00+08:00`);
      if (!Number.isFinite(start.getTime())) throw new Error("Choose a valid consultation date and time.");

      return apiClient.post("/api/consultations", {
        researchId: selectedProjectId,
        adviserId: fields.get("adviserId"),
        title,
        description: fields.get("description"),
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(start.getTime() + 3_600_000).toISOString(),
      });
    },
    onSuccess: () => {
      close();
      setNotice("Request sent. Awaiting adviser approval.");
      void refresh();
    },
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
            <select required className={inputClass} value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Choose a group</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}
            </select>
          </label>}
          <label className="flex flex-col gap-1 font-semibold">
            Assigned adviser
            <select key={selectedProjectId} name="adviserId" className={inputClass} required>
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
              <input name="date" type="date" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Preferred time
              <input name="time" type="time" required className={inputClass} />
            </label>
          </div>
          <label className="flex flex-col gap-1 font-semibold">Description (optional)
            <textarea name="description" maxLength={5000} rows={3} className={inputClass} />
          </label>
          <p className="text-[var(--color-text-secondary)]">Times are in Philippine time.</p>
          {booking.error && <p role="alert" className="text-red-700 dark:text-red-300">{booking.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="lg" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" size="lg" isLoading={booking.isPending} disabled={!advisers.data?.recipients.length}>Send request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
