import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import type { ConsultationProof } from "@/lib/consultation-store";
import { ConsultationMeetingForm, useRefreshConsultations, type ConsultationEdit } from "./ConsultationMeetingForm";
import { ConsultationRecordButton } from "./ConsultationRecordButton";

export async function joinConsultation(id: string, onError: (message: string) => void) {
  const meeting = window.open("about:blank", "_blank");
  if (!meeting) {
    onError("Allow pop-ups for Advisio, then select Join Meet again.");
    return;
  }
  meeting.opener = null;
  try {
    const { meetingUrl } = await apiClient.post<{ meetingUrl: string }>(`/api/consultations/${id}/join`, {});
    meeting.location.replace(meetingUrl);
  } catch (error) {
    meeting.close();
    onError(error instanceof Error ? error.message : "Unable to open this consultation.");
  }
}

export type ManagedConsultation = Omit<ConsultationEdit, "scheduledStart" | "scheduledEnd"> & {
  scheduledStart?: string;
  scheduledEnd?: string;
  researchId?: string;
  status: string;
  meetingKind?: string;
  canManage?: boolean;
  calendarUpdatePending?: boolean;
  proof?: ConsultationProof | null;
};

export function ConsultationActions({ item, viewerId, canWithdraw = false, approvalVisible = true }: {
  item: ManagedConsultation;
  viewerId?: string;
  canWithdraw?: boolean;
  approvalVisible?: boolean;
}) {
  const [edit, setEdit] = useState<{ mode: "reschedule" | "propose"; record: ConsultationEdit } | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "decline" | "complete" | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = useRefreshConsultations();
  const status = item.status.toLowerCase();
  const instant = item.meetingKind?.toLowerCase() === "instant";
  const requested = status === "requested";
  const provisioning = status === "provisioning";
  const scheduled = status === "scheduled";
  const ongoing = status === "ongoing";
  const canComplete = ongoing || (scheduled && Date.parse(item.scheduledStart || "") <= Date.now());
  const dates = item.scheduledStart && item.scheduledEnd ? { scheduledStart: item.scheduledStart, scheduledEnd: item.scheduledEnd } : null;
  const canManage = Boolean(item.canManage);
  const openEdit = (mode: "reschedule" | "propose") => {
    if (dates) setEdit({ mode, record: { ...item, ...dates } });
  };
  const action = useMutation({
    mutationFn: (value: "approve" | "cancel" | "decline" | "complete") =>
      apiClient.patch<{ warning?: string }>(`/api/consultations/${item.id}${value === "approve" ? "/approve" : ""}`,
        value === "approve" ? {} : { action: value }),
    onSuccess: ({ warning }, value) => {
      setConfirm(null);
      setNotice(warning || ({
        approve: "Meeting ready.", cancel: "Consultation cancelled.", decline: "Request declined.", complete: "Advisio session completed.",
      })[value]);
    },
    onSettled: () => { void refresh(); },
  });
  const canCancel = (canManage && (provisioning || scheduled || ongoing)) || (canWithdraw && requested);
  const command = (value: "approve" | "cancel" | "decline" | "complete") => {
    setNotice("");
    action.mutate(value);
  };
  const record = <ConsultationRecordButton id={item.id} status={item.status} scheduledStart={item.scheduledStart} proof={item.proof} />;
  if (!canManage && !canCancel) return record;

  return <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
    {record}
    {canManage && requested && <>
      {approvalVisible && <Button type="button" size="sm" disabled={action.isPending} onClick={() => command("approve")}>Approve</Button>}
      {dates && <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => openEdit("propose")}>Approve with new time</Button>}
      <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => setConfirm("decline")}>Decline</Button>
    </>}
    {canManage && provisioning && <Button type="button" size="sm" disabled={action.isPending} onClick={() => command("approve")}>Retry Google Calendar</Button>}
    {canManage && item.calendarUpdatePending && <span role="status">Calendar edit awaiting sync</span>}
    {canManage && scheduled && !instant && dates && !item.calendarUpdatePending && <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => openEdit("reschedule")}>Edit</Button>}
    {canCancel && <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => setConfirm("cancel")}>{requested ? "Withdraw request" : "Cancel consultation"}</Button>}
    {canManage && canComplete && !item.calendarUpdatePending && <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => setConfirm("complete")}>{instant ? "End Advisio session" : "Mark complete"}</Button>}
    {confirm && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm consultation change">
      <span>{confirm === "complete" ? "End this session in Advisio? The Google Meet call can continue." : confirm === "decline" ? "Decline this request?" : "Cancel this consultation?"}</span>
      <Button type="button" size="sm" disabled={action.isPending} onClick={() => command(confirm)}>Confirm</Button>
      <Button type="button" size="sm" variant="secondary" disabled={action.isPending} onClick={() => { action.reset(); setConfirm(null); }}>Back</Button>
    </div>}
    {action.error && <p role="alert" className="basis-full text-red-700 dark:text-red-300">{action.error.message}</p>}
    {notice && <p role="status" className="basis-full">{notice}</p>}
    {edit && <ConsultationMeetingForm projects={[]} initialProjectId={item.researchId} edit={edit.record} propose={edit.mode === "propose"}
      viewerId={viewerId} onClose={() => setEdit(null)} onResult={setNotice} />}
  </div>;
}
