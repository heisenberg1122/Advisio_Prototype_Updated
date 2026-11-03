import { useCallback, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { studentKeys } from "@/hooks/use-student";
import { apiClient } from "@/lib/api-client";

const inputClass = "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-[var(--color-primary)]";

export function ConsultationBooking({ projectId, firstName }: { projectId?: string; firstName?: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const close = useCallback(() => setIsOpen(false), []);
  const booking = useMutation({
    mutationFn: async (fields: FormData) => {
      if (!projectId) throw new Error("Select a research project first.");
      const title = String(fields.get("topic") ?? "").trim();
      if (!title) throw new Error("Enter a discussion topic.");
      const start = new Date(`${fields.get("date")}T${fields.get("time")}:00+08:00`);
      if (!Number.isFinite(start.getTime())) throw new Error("Choose a valid consultation date and time.");

      return apiClient.post<{ warning?: string }>("/api/consultations", {
        researchId: projectId,
        title,
        description: `Student consultation requested by ${firstName || "Student"}`,
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(start.getTime() + 3_600_000).toISOString(),
      });
    },
    onSuccess: ({ warning }) => {
      close();
      setNotice(warning
        ? `Request sent. ${warning}`
        : "Request sent. Awaiting adviser approval.");
      void queryClient.invalidateQueries({ queryKey: studentKeys.consultations() });
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
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
        onClose={close}
        title="Book a Consultation Session"
        subtitle="Your adviser will review and confirm the schedule."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
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
          <p className="text-[var(--color-text-secondary)]">Times are in Philippine time. Send your request at least 48 hours ahead.</p>
          {booking.error && <p role="alert" className="text-red-700 dark:text-red-300">{booking.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="lg" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" size="lg" isLoading={booking.isPending}>Send request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
