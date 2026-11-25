import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";

type Issuance = {
  issued: boolean;
  deans: Array<{ id: string; firstName: string; lastName: string }>;
};

export function DefenseCertificateIssuance({ sessionId, onIssued }: {
  sessionId: string;
  onIssued: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [deanId, setDeanId] = useState("");
  const endpoint = `/api/defense-sessions/${sessionId}/certificates/issuance`;
  const query = useQuery({
    queryKey: ["defense-certificate-issuance", sessionId],
    queryFn: ({ signal }) => apiClient.get<Issuance>(endpoint, { signal }),
    enabled: open,
  });
  const issue = useMutation({
    mutationFn: () => apiClient.post<Issuance>(endpoint, { deanId }),
    onSuccess: () => {
      setOpen(false);
      void onIssued();
    },
  });
  if (issue.isSuccess || query.data?.issued) {
    return <span className="text-sm text-[var(--color-text-secondary)]">Certificates issued</span>;
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Confirm certificate dean</Button>
      <Modal
        isOpen={open}
        onClose={() => { if (!issue.isPending) setOpen(false); }}
        title="Confirm certificate dean"
        footer={query.data?.deans.length ? (
          <Button disabled={!deanId} isLoading={issue.isPending} onClick={() => issue.mutate()}>
            Issue certificates
          </Button>
        ) : undefined}
      >
        {query.isPending && <p role="status">Loading college deans…</p>}
        {(query.error || issue.error) && <p role="alert">{(query.error || issue.error)?.message}</p>}
        {query.data && (query.data.deans.length ? (
          <label className="block space-y-2 text-[var(--color-text-primary)]">
            <span className="block font-semibold">Dean to name on the certificates</span>
            <select
              value={deanId}
              onChange={(event) => setDeanId(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            >
              <option value="">Select a dean</option>
              {query.data.deans.map((dean) => (
                <option key={dean.id} value={dean.id}>{dean.firstName} {dean.lastName}</option>
              ))}
            </select>
          </label>
        ) : <p>Assign an active dean to this college before issuing certificates.</p>)}
      </Modal>
    </>
  );
}
