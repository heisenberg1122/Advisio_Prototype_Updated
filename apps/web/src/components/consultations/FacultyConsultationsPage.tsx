import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageContainer } from "@/components/ui/PageContainer";
import { apiClient } from "@/lib/api-client";
import { calendarDaysUntil } from "@/lib/researcher-home";
import { CountStrip, DateTile, EmptyNote, InlineFeedback, ListRow, PageBand, SectionCard, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { useAuth } from "@/providers/auth-provider";

type Workspace = "coordinator" | "panelist" | "dean";
import { ConsultationMeetingForm, type ConsultationProject } from "./ConsultationMeetingForm";
import { ConsultationActions, joinConsultation, type ManagedConsultation } from "./ConsultationActions";

const statusLabels = {
  REQUESTED: "Awaiting approval",
  PROVISIONING: "Preparing Google Meet",
  DECLINED: "Declined",
  SCHEDULED: "Scheduled",
  ONGOING: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type Consultation = ManagedConsultation & {
  id: string;
  title: string;
  status: keyof typeof statusLabels;
  scheduledStart: string;
  scheduledEnd: string;
  meetingUrl?: string | null;
  conferenceState?: string;
  attendanceStatus?: string;
  research: Omit<ConsultationProject, "id">;
};

const descriptions: Record<Workspace, string> = {
  coordinator: "Schedule consultations and review requests for the research groups you oversee.",
  panelist: "See consultations you have been invited to.",
  dean: "Review consultation schedules and status across your active college.",
};
const roleLabels: Record<Workspace, string> = {
  coordinator: "Research coordinator",
  panelist: "Panelist",
  dean: "Dean",
};
const emptyText: Record<Workspace, string> = {
  coordinator: "Consultations you schedule or approve for your groups appear here.",
  panelist: "Consultations you are invited to appear here.",
  dean: "Consultations scheduled across your college appear here.",
};
const statusTones: Record<Consultation["status"], StatusTone> = {
  REQUESTED: "waiting",
  PROVISIONING: "waiting",
  DECLINED: "attention",
  SCHEDULED: "brand",
  ONGOING: "live",
  COMPLETED: "done",
  CANCELLED: "neutral",
};
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

function projectLabel(project: Omit<ConsultationProject, "id">) {
  return project.groupName ? `${project.groupName} · ${project.title}` : project.title;
}

function ScheduleConsultation({ scope, instant, onClose, onScheduled }: {
  scope: string;
  instant: boolean;
  onClose: () => void;
  onScheduled: (notice: string) => void;
}) {
  const projects = useQuery({
    queryKey: ["consultation-projects", scope],
    queryFn: () => apiClient.get<{ projects: ConsultationProject[] }>("/api/consultations/workspace/coordinator/projects"),
  });
  if (projects.data?.projects.length) return <ConsultationMeetingForm projects={projects.data.projects} instant={instant} onClose={onClose} onResult={onScheduled} />;
  return <Modal isOpen onClose={onClose} title="Consultation projects">
    {projects.isPending && <p role="status">Loading your projects…</p>}
    {projects.isError && <div className="space-y-3"><p role="alert">{projects.error.message}</p>
      <Button variant="secondary" onClick={() => void projects.refetch()}>Try again</Button></div>}
    {projects.isSuccess && <p>You don’t have any active projects to schedule consultations for.</p>}
  </Modal>;
}

function ConsultationWorkspace({ workspace, scope, viewerId }: { workspace: Workspace; scope: string; viewerId?: string }) {
  const [params, setParams] = useSearchParams();
  const linkedId = params.get("consultationId") || undefined;
  const [page, setPage] = useState(1);
  const [scheduling, setScheduling] = useState<"scheduled" | "instant" | null>(null);
  const [notice, setNotice] = useState("");
  const [joinError, setJoinError] = useState("");
  const consultations = useQuery({
    queryKey: ["faculty-consultations", scope, workspace, page, linkedId],
    queryFn: () => apiClient.get<{ consultations: Consultation[]; hasNextPage: boolean }> (
      "/api/consultations/workspace/" + workspace, { params: { page, consultationId: linkedId } },
    ),
    refetchInterval: 15_000,
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
        actions={workspace === "coordinator" ? <div className="flex flex-wrap gap-2">
          <Button onClick={() => setScheduling("scheduled")}>Schedule consultation</Button>
          <Button variant="secondary" onClick={() => setScheduling("instant")}>Instant Google Meet</Button>
        </div> : undefined}
      />

      {notice && <InlineFeedback tone="ok">{notice}</InlineFeedback>}
      {joinError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{joinError}</p>}
      {linkedId && <Button variant="secondary" onClick={() => { setPage(1); setParams({}); }}>Show all consultations</Button>}
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
              const meeting = Boolean(item.meetingUrl);
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
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <StatusDot tone={statusTones[item.status]}>{item.conferenceState === "FAILED" && item.status === "PROVISIONING" ? "Calendar setup failed" : statusLabels[item.status]}</StatusDot>
                        {meeting && <Button size="sm" variant="secondary" onClick={() => { setJoinError(""); void joinConsultation(item.id, setJoinError); }}>
                          <Video className="size-4" aria-hidden="true" /> Join Meet
                        </Button>}
                        {item.attendanceStatus === "INVITED" && meeting && <span className="text-xs">Invited</span>}
                        <ConsultationActions item={item} viewerId={viewerId} approvalVisible={Date.parse(item.scheduledEnd) > Date.now()} />
                      </div>
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

      {scheduling && <ScheduleConsultation scope={scope} instant={scheduling === "instant"} onClose={() => setScheduling(null)} onScheduled={(message) => {
        setNotice(message);
        setPage(1);
      }} />}
    </PageContainer>
  );
}

export default function FacultyConsultationsPage({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const scope = `${user?.id ?? ""}:${user?.college?.id ?? ""}`;
  return <ConsultationWorkspace key={`${scope}:${workspace}`} workspace={workspace} scope={scope} viewerId={user?.id} />;
}
