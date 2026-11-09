import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

export type ConsultationProject = { id: string; title: string; groupName?: string | null };
type Recipient = { id: string; name: string; roles: string[] };
export type ConsultationEdit = {
  id: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  participants?: { userId: string; user: { firstName: string; lastName: string } }[];
  createdBy?: string;
  revision?: number;
};

const fieldClass = "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2";
const feedbackClass = "text-sm text-red-700 dark:text-red-300";

export function useRefreshConsultations() {
  const queryClient = useQueryClient();
  return () => Promise.all(["consultations", "faculty-consultations", "student-consultations", "universal-calendar", "notifications"].map(
    (key) => queryClient.invalidateQueries({ queryKey: [key] }),
  ));
}

export function useConsultationRecipients(projectId?: string, options: { instant?: boolean; adviser?: boolean; search?: string; enabled?: boolean } = {}) {
  const { user } = useAuth();
  const { instant, adviser, search, enabled = true } = options;
  return useQuery({
    queryKey: ["consultation-recipients", user?.id, user?.college?.id, projectId, Boolean(instant), Boolean(adviser), search],
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
    queryFn: () => apiClient.get<{ recipients: Recipient[] }>("/api/consultations/recipients", {
      params: { researchId: projectId, instant: instant ? "true" : undefined, adviser: adviser ? "true" : undefined, q: search },
    }),
  });
}

function RecipientPicker({ projectId, instant, selected, setSelected }: {
  projectId: string;
  instant: boolean;
  selected: Recipient[];
  setSelected: (value: Recipient[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const recipients = useConsultationRecipients(projectId, { instant, search: query });
  const options = recipients.data?.recipients ?? [];
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-[var(--color-border)] p-3">
      <legend className="px-1 font-semibold">Participants ({selected.length} selected)</legend>
      <label className="block">
        <span className="sr-only">Search permitted participants</span>
        <input type="search" className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" />
      </label>
      {selected.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Selected participants">
        {selected.map((item) => <li key={item.id}>
          <button type="button" className="min-h-9 rounded-lg border border-[var(--color-border)] px-2" onClick={() => setSelected(selected.filter(({ id }) => id !== item.id))} aria-label={`Remove ${item.name}`}>{item.name} ×</button>
        </li>)}
      </ul>}
      <div className="max-h-40 overflow-y-auto">
        {!projectId && <p>Select a research group to find participants.</p>}
        {projectId && recipients.isPending && <p>Loading participants…</p>}
        {recipients.isError && <p role="alert" className={feedbackClass}>{recipients.error.message}</p>}
        {recipients.isSuccess && !options.length && <p>No eligible participants found.</p>}
        {options.map((item) => {
          const checked = selected.some(({ id }) => id === item.id);
          return <label key={item.id} className="flex min-h-9 items-center gap-2 border-b border-[var(--color-border)]">
            <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 40} onChange={(event) =>
              setSelected(event.target.checked ? [...selected, item] : selected.filter(({ id }) => id !== item.id))
            } />
            <span>{item.name}{item.roles.length > 0 && <small className="ml-2 opacity-75">{item.roles.join(", ")}</small>}</span>
          </label>;
        })}
      </div>
    </fieldset>
  );
}

const localDateTime = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 16);

export function ConsultationMeetingForm({ projects, initialProjectId, instant = false, edit, propose = false, viewerId, onClose, onResult, adviserGuide = false }: {
  projects: ConsultationProject[];
  initialProjectId?: string;
  instant?: boolean;
  edit?: ConsultationEdit;
  propose?: boolean;
  viewerId?: string;
  onClose: () => void;
  onResult: (message: string) => void;
  adviserGuide?: boolean;
}) {
  const refresh = useRefreshConsultations();
  const [projectId, setProjectId] = useState(initialProjectId || (projects.length === 1 ? projects[0].id : ""));
  const [selected, setSelected] = useState<Recipient[]>(() => (edit?.participants || [])
    .filter(({ userId }) => userId !== viewerId && userId !== edit?.createdBy)
    .map(({ userId, user }) => ({ id: userId, name: `${user.firstName} ${user.lastName}`, roles: [] })));
  const [changeParticipants, setChangeParticipants] = useState(false);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const meeting = useMutation({
    mutationFn: async (fields: FormData) => {
      const rawStart = String(fields.get("start") || "");
      const start = new Date(rawStart.includes("T") ? `${rawStart}:00+08:00` : `${fields.get("date")}T${fields.get("time")}:00+08:00`);
      const rawEnd = String(fields.get("end") || "");
      const end = rawEnd ? new Date(`${rawEnd}:00+08:00`) : new Date(+start + 3_600_000);
      const schedule = instant ? {} : { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
      const participantIds = selected.map(({ id }) => id).sort();
      if (edit) return apiClient.patch<{ warning?: string }>(`/api/consultations/${edit.id}${propose ? "/approve" : ""}`, {
        ...schedule,
        ...(!propose ? { action: "reschedule", revision: edit.revision, ...(changeParticipants ? { participantIds } : {}) } : {}),
      });
      const payload = {
        researchId: projectId, instant, title: String(fields.get("topic") || "").trim(),
        description: String(fields.get("description") || "").trim(),
        meetingUrl: String(fields.get("meetingUrl") || "").trim(),
        participantIds, ...schedule,
      };
      const fingerprint = JSON.stringify(payload);
      if (request.current?.payload !== fingerprint) request.current = { payload: fingerprint, key: crypto.randomUUID() };
      return apiClient.post<{ warning?: string }>("/api/consultations", { ...payload, requestKey: request.current.key });
    },
    onSuccess: ({ warning }) => {
      onResult(warning || (instant ? "Instant meeting is ready. Open it from Consultations."
        : propose ? "Request approved with the new time." : edit ? "Consultation updated." : "Consultation scheduled."));
      onClose();
    },
    onSettled: () => { void refresh(); },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!meeting.isPending) meeting.mutate(new FormData(event.currentTarget));
  };
  const title = propose ? "Approve with a new time" : edit ? "Edit consultation" : instant ? "Start an instant Google Meet" : "Schedule a consultation";

  return <Modal isOpen onClose={() => { if (!meeting.isPending) onClose(); }} title={title}
    subtitle={edit ? edit.title : "Invited participants receive the same meeting link."} maxWidth="lg">
    <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
      {!edit && <>
        <label className="grid gap-1 font-semibold">Research group
          <select required value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelected([]); }} className={fieldClass}
            data-guide={adviserGuide ? "adviser-consultation-group" : undefined} data-guide-empty={!projects.length}>
            <option value="">Choose a research group</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.groupName || project.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 font-semibold">Topic
          <input name="topic" required maxLength={200} className={fieldClass} data-guide={adviserGuide ? "adviser-consultation-topic" : undefined} />
        </label>
        <label className="grid gap-1 font-semibold">Description (optional)
          <textarea name="description" rows={2} maxLength={5000} className={fieldClass} />
        </label>
      </>}
      {!instant && <div className="grid gap-3 sm:grid-cols-2">
        {edit ? <>
          <label className="grid gap-1 font-semibold">Starts (Philippine time)<input name="start" type="datetime-local" required className={fieldClass} defaultValue={localDateTime(edit.scheduledStart)} /></label>
          <label className="grid gap-1 font-semibold">Ends (Philippine time)<input name="end" type="datetime-local" required className={fieldClass} defaultValue={localDateTime(edit.scheduledEnd)} /></label>
        </> : <>
          <label className="grid gap-1 font-semibold">Date (Philippine time)<input name="date" type="date" required className={fieldClass} data-guide={adviserGuide ? "adviser-consultation-date" : undefined} /></label>
          <label className="grid gap-1 font-semibold">Time<input name="time" type="time" required className={fieldClass} data-guide={adviserGuide ? "adviser-consultation-time" : undefined} /></label>
        </>}
      </div>}
      {!edit && !instant && <label className="grid gap-1 font-semibold">End (Philippine time, optional)
        <input name="end" type="datetime-local" className={fieldClass} />
        <span className="text-xs font-normal">Defaults to one hour after the start.</span>
      </label>}
      {!edit && !instant && <label className="grid gap-1 font-semibold">Existing Google Meet link (optional)
        <input name="meetingUrl" type="url" maxLength={500} className={fieldClass} placeholder="Generate a new room when blank" />
      </label>}
      {edit?.participants && !propose && <label className="flex items-center gap-2">
        <input type="checkbox" checked={changeParticipants} onChange={(event) => setChangeParticipants(event.target.checked)} /> Change participants
      </label>}
      {(!edit || changeParticipants) && <RecipientPicker key={projectId} projectId={projectId} instant={instant} selected={selected} setSelected={setSelected} />}
      {meeting.error && <p role="alert" className={feedbackClass}>{meeting.error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={meeting.isPending} onClick={onClose}>Close</Button>
        <Button type="submit" isLoading={meeting.isPending} disabled={!edit && !selected.length}>
          {edit ? (propose ? "Approve" : "Save changes") : instant ? "Create instant meeting" : "Schedule consultation"}
        </Button>
      </div>
    </form>
  </Modal>;
}
