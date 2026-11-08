import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageContainer } from "@/components/ui/PageContainer";
import { apiClient } from "@/lib/api-client";
import { calendarDaysUntil } from "@/lib/researcher-home";
import { CountStrip, DateTile, EmptyNote, InlineFeedback, ListRow, PageBand, SectionCard, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { useAuth } from "@/providers/auth-provider";

type Workspace = "coordinator" | "panelist" | "dean";
type Project = { id: string; title: string; groupName: string | null };

const statusLabels = {
  REQUESTED: "Awaiting approval",
  SCHEDULED: "Scheduled",
  ONGOING: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type Consultation = {
  id: string;
  title: string;
  status: keyof typeof statusLabels;
  scheduledStart: string;
  scheduledEnd: string;
  meetingUrl?: string | null;
  research: Omit<Project, "id">;
};

const descriptions: Record<Workspace, string> = {
  coordinator: "Schedule consultations and review requests for the research groups you oversee.",
  panelist: "See project consultations for the research groups you’re assigned to.",
  dean: "Review consultation schedules and status across your active college.",
};
const roleLabels: Record<Workspace, string> = {
  coordinator: "Research coordinator",
  panelist: "Panelist",
  dean: "Dean",
};
const emptyText: Record<Workspace, string> = {
  coordinator: "Consultations you schedule or approve for your groups appear here.",
  panelist: "Consultations the coordinator schedules for your assigned groups appear here.",
  dean: "Consultations scheduled across your college appear here.",
};
const statusTones: Record<Consultation["status"], StatusTone> = {
  REQUESTED: "waiting",
  SCHEDULED: "brand",
  ONGOING: "live",
  COMPLETED: "done",
  CANCELLED: "neutral",
};
const fieldClass = "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2";
const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

const timeOnly = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});
const monthOnly = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "Asia/Manila" });
const dayOnly = new Intl.DateTimeFormat("en-PH", { day: "numeric", timeZone: "Asia/Manila" });
const shortDay = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

function dayLabel(date: Date) {
  const offset = calendarDaysUntil(date, Date.now());
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return shortDay.format(date);
}

function httpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function projectLabel(project: Omit<Project, "id">) {
  return project.groupName ? `${project.groupName} · ${project.title}` : project.title;
}

function ScheduleConsultation({ scope, onClose, onScheduled }: {
  scope: string;
  onClose: () => void;
  onScheduled: (notice: string) => void;
}) {
  const projects = useQuery({
    queryKey: ["consultation-projects", scope],
    queryFn: () => apiClient.get<{ projects: Project[] }>("/api/consultations/workspace/coordinator/projects"),
  });
  const schedule = useMutation({
    mutationFn: (form: FormData) => {
      const start = new Date(`${form.get("start")}:00+08:00`);
      const end = new Date(`${form.get("end")}:00+08:00`);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new Error("Choose an end time after the start time.");
      }
      const meetingUrl = String(form.get("meetingUrl") ?? "").trim();
      if (meetingUrl && !httpsUrl(meetingUrl)) throw new Error("Enter a valid HTTPS meeting link.");
      return apiClient.post<{ warning?: string }>("/api/consultations", {
        researchId: form.get("project"),
        title: form.get("title"),
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        meetingUrl,
      });
    },
    onSuccess: ({ warning }) => {
      onScheduled(warning || "Consultation scheduled.");
      onClose();
    },
  });
  const options = projects.data?.projects ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedule.isPending) schedule.mutate(new FormData(event.currentTarget));
  }

  return (
    <Modal isOpen onClose={schedule.isPending ? () => {} : onClose} title="Schedule a consultation">
      {projects.isPending && <p role="status">Loading your projects…</p>}
      {projects.isError && (
        <div className="space-y-3">
          <p role="alert">{projects.error.message}</p>
          <Button variant="secondary" onClick={() => void projects.refetch()}>Try again</Button>
        </div>
      )}
      {projects.isSuccess && options.length === 0 && <p>You don’t have any active projects to schedule consultations for.</p>}
      {options.length > 0 && (
        <form className="flex flex-col gap-4 text-sm" onSubmit={submit}>
          <label className="grid gap-1.5 font-semibold">
            Research project
            <select name="project" required defaultValue="" className={fieldClass}>
              <option value="" disabled>Choose a project</option>
              {options.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 font-semibold">
            Discussion topic
            <input name="title" required maxLength={200} className={fieldClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 font-semibold">
              Start (Philippine time)
              <input name="start" type="datetime-local" required className={fieldClass} />
            </label>
            <label className="grid min-w-0 gap-1.5 font-semibold">
              End (Philippine time)
              <input name="end" type="datetime-local" required className={fieldClass} />
            </label>
          </div>
          <label className="grid gap-1.5 font-semibold">
            Meeting link (optional)
            <input name="meetingUrl" type="url" maxLength={500} placeholder="https://meet.google.com/…" className={fieldClass} />
          </label>
          {schedule.error && <p role="alert" className="text-red-700 dark:text-red-300">{schedule.error.message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={schedule.isPending}>Cancel</Button>
            <Button type="submit" isLoading={schedule.isPending} loadingText="Scheduling…">Schedule consultation</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ConsultationWorkspace({ workspace, scope }: { workspace: Workspace; scope: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [scheduling, setScheduling] = useState(false);
  const [notice, setNotice] = useState("");
  const consultations = useQuery({
    queryKey: ["faculty-consultations", scope, workspace, page],
    queryFn: () => apiClient.get<{ consultations: Consultation[]; hasNextPage: boolean }>(
      `/api/consultations/workspace/${workspace}`, { params: { page } },
    ),
  });

  function refreshLists() {
    for (const key of ["faculty-consultations", "consultations", "universal-calendar"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const approval = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/consultations/${id}/approve`),
    onSuccess: () => setNotice("Consultation approved."),
    onSettled: refreshLists,
  });

  const items = consultations.data?.consultations ?? [];
  // Counts only describe the whole list when it fits on one page.
  const showCounts = consultations.isSuccess && page === 1 && !consultations.data.hasNextPage;
  const count = (...statuses: Consultation["status"][]) => items.filter((item) => statuses.includes(item.status)).length;

  return (
    <PageContainer>
      <PageBand
        titleId="consultations-title"
        eyebrow={`${roleLabels[workspace]} · Philippine time`}
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-6 text-[var(--color-primary)]" />
            Consultations
          </span>
        }
        meta={descriptions[workspace]}
        counts={showCounts ? (
          <CountStrip
            label="Consultation summary"
            items={[
              { label: "Upcoming", value: count("SCHEDULED", "ONGOING") },
              { label: "Awaiting approval", value: count("REQUESTED"), tone: count("REQUESTED") ? "waiting" : undefined },
              { label: "Completed", value: count("COMPLETED") },
            ]}
          />
        ) : undefined}
        actions={workspace === "coordinator" ? <Button onClick={() => setScheduling(true)}>Schedule consultation</Button> : undefined}
      />

      {notice && <InlineFeedback tone="ok">{notice}</InlineFeedback>}
      {approval.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{approval.error.message}</p>}
      <SectionCard title="Project consultations" titleId="consultations-list" count={consultations.isSuccess ? items.length : undefined}>
        {consultations.isPending && <p role="status" className="au-card-body text-sm text-[var(--color-text-secondary)]">Loading consultations…</p>}
        {consultations.isError && (
          <div className="au-card-body space-y-3">
            <p role="alert">{consultations.error.message}</p>
            <Button variant="secondary" onClick={() => void consultations.refetch()}>Try again</Button>
          </div>
        )}
        {consultations.isSuccess && items.length === 0 && (
          <EmptyNote layout="row" icon="ti-calendar-time" title="No consultations yet" text={emptyText[workspace]} />
        )}
        {items.length > 0 && (
          <ul className="au-list">
            {items.map((item) => {
              const meeting = item.status === "SCHEDULED" || item.status === "ONGOING" ? httpsUrl(item.meetingUrl) : null;
              const start = new Date(item.scheduledStart);
              return (
                <li key={item.id}>
                  <ListRow
                    leading={
                      <DateTile
                        tone={item.status === "ONGOING" ? "live" : item.status === "COMPLETED" || item.status === "CANCELLED" ? "muted" : undefined}
                        top={monthOnly.format(start)}
                        bottom={dayOnly.format(start)}
                        label={dateTime.format(start)}
                      />
                    }
                    title={item.title}
                    titleHint={item.title}
                    meta={
                      <>
                        {projectLabel(item.research)} · {dayLabel(start)},{" "}
                        <time dateTime={item.scheduledStart}>{timeOnly.format(start)}</time>
                        {" – "}
                        <time dateTime={item.scheduledEnd}>{timeOnly.format(new Date(item.scheduledEnd))}</time>
                      </>
                    }
                    end={
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        <StatusDot tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusDot>
                        {workspace === "coordinator" && item.status === "REQUESTED" && (
                          <Button size="sm" variant="secondary" disabled={approval.isPending} isLoading={approval.isPending && approval.variables === item.id} onClick={() => {
                            setNotice("");
                            approval.mutate(item.id);
                          }}>Approve</Button>
                        )}
                        {meeting && workspace !== "dean" && (
                          <a href={meeting.href} target="_blank" rel="noopener noreferrer" className="au-link">
                            <Video className="size-4" aria-hidden="true" />
                            {meeting.hostname === "meet.google.com" ? "Google Meet" : "Meeting link"}
                          </a>
                        )}
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {(page > 1 || consultations.data?.hasNextPage) && (
          <nav aria-label="Consultation pages" className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] p-4">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm">Page {page}</span>
            <Button variant="secondary" size="sm" disabled={!consultations.data?.hasNextPage} onClick={() => setPage(page + 1)}>Next</Button>
          </nav>
        )}
      </SectionCard>

      {scheduling && <ScheduleConsultation scope={scope} onClose={() => setScheduling(false)} onScheduled={(message) => {
        setNotice(message);
        setPage(1);
        refreshLists();
      }} />}
    </PageContainer>
  );
}

export default function FacultyConsultationsPage({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const scope = `${user?.id ?? ""}:${user?.college?.id ?? ""}`;
  return <ConsultationWorkspace key={`${scope}:${workspace}`} workspace={workspace} scope={scope} />;
}
