import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";
import type { ConsultationProof } from "@/lib/consultation-store";
import { useAuth } from "@/providers/auth-provider";
import { useRefreshConsultations } from "./ConsultationMeetingForm";

type RecordView = {
  title: string;
  project: string;
  scheduledStart: string;
  scheduledEnd: string;
  proof: ConsultationProof | null;
  reviewers: { id: string; name: string }[];
  canReview: boolean;
  details: {
    revision: number;
    actualStart: string;
    actualEnd: string;
    summary: string;
    nextSteps: string;
    submittedBy: string;
    reviewerId: string;
    reviewer: string;
    correction: string | null;
  } | null;
};

type RecordAction =
  | { action: "submit"; revision: number; actualStart: string; actualEnd: string; summary: string; nextSteps: string; reviewerId: string }
  | { action: "confirm"; revision: number }
  | { action: "request_correction"; revision: number; correction: string };

const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});
const formatDate = (value: string) => dateTime.format(new Date(value));
const range = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;
const inputTime = (value?: string) => value ? new Date(Date.parse(value) + 8 * 3_600_000).toISOString().slice(0, 16) : "";
const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2";
const statusLabels = {
  awaiting_confirmation: "Awaiting confirmation",
  correction_requested: "Correction requested",
  confirmed: "Confirmed by both participants",
};

export function ConsultationRecordButton({ id, status, scheduledStart, proof }: {
  id: string;
  status: string;
  scheduledStart?: string;
  proof?: ConsultationProof | null;
}) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const linked = params.get("record") === "1" && params.get("consultationId") === id;
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissedLink, setDismissedLink] = useState<string>();
  const open = manualOpen || (linked && dismissedLink !== search);
  const state = status.toLowerCase();
  if (!proof && state !== "completed" &&
      !(["scheduled", "ongoing"].includes(state) && scheduledStart && Date.parse(scheduledStart) <= Date.now())) return null;
  return <>
    {proof && <span className="text-xs text-[var(--color-text-secondary)]">
      {statusLabels[proof.status]}{proof.status === "confirmed" ? ` · ${proof.durationMinutes} min` : ""}
    </span>}
    <Button type="button" size="sm" variant="secondary" onClick={() => setManualOpen(true)}>
      {proof && "needsAction" in proof && proof.needsAction
        ? proof.status === "correction_requested" ? "Revise consultation record" : "Review consultation record"
        : "Consultation record"}
    </Button>
    {open && <RecordDialog id={id} onClose={() => { setManualOpen(false); setDismissedLink(search); }} />}
  </>;
}

function RecordDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const client = useQueryClient();
  const refresh = useRefreshConsultations();
  const endpoint = `/api/consultations/${id}/record`;
  const key = ["consultation-record", user?.id, user?.college?.id, pathname, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiClient.get<RecordView>(endpoint),
    retry: false,
    gcTime: 0,
  });
  const record = query.data;
  const details = record?.details;
  const proof = record?.proof;
  const [correcting, setCorrecting] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const action = useMutation({
    mutationFn: (payload: RecordAction) => apiClient.patch<RecordView>(endpoint, payload),
    onSuccess: (updated) => {
      client.setQueryData(key, updated);
      setCorrecting(false);
      void refresh();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) || "");
    action.mutate({
      action: "submit", revision: details?.revision ?? 0,
      actualStart: `${value("actualStart")}:00+08:00`,
      actualEnd: `${value("actualEnd")}:00+08:00`,
      summary: value("summary"), nextSteps: value("nextSteps"), reviewerId: value("reviewerId"),
    });
  }

  async function download(format: "proof" | "full") {
    if (proof?.status !== "confirmed") return;
    setDownloadError("");
    setDownloadBusy(true);
    try {
      const blob = await apiClient.file(`${endpoint}/pdf?format=${format}`, { expectedMimeType: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${proof.reference}-${format}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "The PDF could not be downloaded.");
    } finally {
      setDownloadBusy(false);
    }
  }

  return <Modal isOpen onClose={onClose} title="Consultation record" subtitle={record?.title} maxWidth="xl">
    <div className="space-y-4 text-sm">
      {query.isPending && <p role="status">Loading consultation record…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {record && <>
        <p><strong>{record.project}</strong><br />Scheduled · {range(record.scheduledStart, record.scheduledEnd)} Philippine time</p>
        {proof && <p role="status" className="font-semibold">{statusLabels[proof.status]}</p>}
        {proof?.status === "confirmed" && <>
          <dl className="space-y-2">
            <div><dt className="font-semibold">Participant-confirmed time</dt><dd>{range(proof.actualStart, proof.actualEnd)} Philippine time · {proof.durationMinutes} min</dd></div>
            <div><dt className="font-semibold">Submitted by</dt><dd>{proof.submittedBy} · {formatDate(proof.submittedAt)}</dd></div>
            <div><dt className="font-semibold">Confirmed by</dt><dd>{proof.confirmedBy} · {formatDate(proof.confirmedAt)}</dd></div>
            <div><dt className="font-semibold">Reference number</dt><dd className="break-all">{proof.reference}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={downloadBusy} onClick={() => void download("proof")}>Download proof PDF</Button>
            {details && <Button size="sm" variant="secondary" disabled={downloadBusy} onClick={() => void download("full")}>Download full record PDF</Button>}
          </div>
        </>}
        {!proof && !record.reviewers.length && <p>No consultation record has been submitted.</p>}
        {details && <>
          {proof?.status !== "confirmed" && <p>
            Reported time · {range(details.actualStart, details.actualEnd)} Philippine time<br />
            Submitted by {details.submittedBy} · Reviewer {details.reviewer}
          </p>}
          <dl className="space-y-2">
            <div><dt className="font-semibold">Summary</dt><dd className="whitespace-pre-wrap break-words">{details.summary}</dd></div>
            <div><dt className="font-semibold">Agreed next steps</dt><dd className="whitespace-pre-wrap break-words">{details.nextSteps || "None recorded"}</dd></div>
            {details.correction && <div><dt className="font-semibold">Requested correction</dt><dd className="whitespace-pre-wrap break-words">{details.correction}</dd></div>}
          </dl>
        </>}
        {record.reviewers.length > 0 && <form key={details?.revision ?? 0} onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">Actual start (Philippine time)<input className={field} name="actualStart" type="datetime-local" required defaultValue={inputTime(details?.actualStart)} /></label>
            <label className="grid gap-1">Actual end (Philippine time)<input className={field} name="actualEnd" type="datetime-local" required defaultValue={inputTime(details?.actualEnd)} /></label>
          </div>
          <label className="grid gap-1">Summary<textarea className={field} name="summary" maxLength={1000} required defaultValue={details?.summary} /></label>
          <label className="grid gap-1">Agreed next steps<textarea className={field} name="nextSteps" maxLength={1000} defaultValue={details?.nextSteps} /></label>
          <label className="grid gap-1">Reviewer<select className={field} name="reviewerId" required defaultValue={
            record.reviewers.find(({ id: reviewerId }) => reviewerId === details?.reviewerId)?.id ??
            (record.reviewers.length === 1 ? record.reviewers[0].id : "")
          }>
            <option value="">Choose an invited participant</option>
            {record.reviewers.map(({ id: reviewerId, name }) => <option key={reviewerId} value={reviewerId}>{name}</option>)}
          </select></label>
          <Button type="submit" disabled={action.isPending}>{details ? "Resubmit for confirmation" : "Submit for confirmation"}</Button>
        </form>}
        {record.canReview && details && (
          correcting ? <form className="space-y-2" onSubmit={(event) => {
            event.preventDefault();
            const correction = String(new FormData(event.currentTarget).get("correction") || "");
            action.mutate({ action: "request_correction", revision: details.revision, correction });
          }}>
            <label className="grid gap-1">What needs to change?<textarea className={field} name="correction" required maxLength={500} /></label>
            <div className="flex gap-2">
              <Button type="submit" disabled={action.isPending}>Send correction request</Button>
              <Button type="button" variant="secondary" onClick={() => setCorrecting(false)}>Back</Button>
            </div>
          </form> : <div className="flex flex-wrap gap-2">
            <Button disabled={action.isPending} onClick={() => action.mutate({ action: "confirm", revision: details.revision })}>Confirm record</Button>
            <Button variant="secondary" disabled={action.isPending} onClick={() => setCorrecting(true)}>Request correction</Button>
          </div>
        )}
      </>}
      {action.error && <p role="alert">{action.error.message} <Button size="sm" variant="ghost" onClick={() => {
        action.reset();
        setCorrecting(false);
        void query.refetch();
      }}>Reload record</Button></p>}
      {downloadError && <p role="alert">{downloadError}</p>}
    </div>
  </Modal>;
}
