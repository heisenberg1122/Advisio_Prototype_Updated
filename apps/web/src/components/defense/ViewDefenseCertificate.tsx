import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileBadge } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api-client";

const PdfPreview = lazy(() => import("@/components/documents/PdfDocumentPreview").then(
  ({ PdfDocumentPreview }) => ({ default: PdfDocumentPreview }),
));

type CertificateDetails = {
  recipientName: string;
  collegeName: string;
  researchTitle: string;
  awardedAt: string;
  coordinator: string;
  dean: string;
  verificationUrl: string;
};

const awardDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" });

export function ViewDefenseCertificate({ sessionId, researcherId }: {
  sessionId: string;
  researcherId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} icon={<FileBadge size={17} aria-hidden />}>
        View Certificate
      </Button>
      {open && createPortal(
        <CertificateModal sessionId={sessionId} researcherId={researcherId} close={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

function CertificateModal({ sessionId, researcherId, close }: {
  sessionId: string;
  researcherId: string;
  close: () => void;
}) {
  const endpoint = `/api/defense-sessions/${sessionId}/certificate`;
  const metadata = useQuery({
    queryKey: ["final-defense-certificate", researcherId, sessionId],
    queryFn: ({ signal }) => apiClient.get<CertificateDetails>(endpoint, { signal }),
    gcTime: 0,
    retry: false,
  });
  const file = useQuery({
    queryKey: ["final-defense-certificate-pdf", researcherId, sessionId],
    queryFn: () => apiClient.file(`${endpoint}/pdf`, { expectedMimeType: "application/pdf" }),
    enabled: metadata.isSuccess,
    gcTime: 0,
    retry: false,
  });
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.data) return;
    const objectUrl = URL.createObjectURL(file.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file.data]);

  const error = metadata.error || file.error;
  const ready = Boolean(!error && url && metadata.data);
  return (
    <Modal
      isOpen
      onClose={close}
      title="Final Defense Certificate"
      subtitle={metadata.data?.recipientName}
      className="max-h-[calc(100dvh-2rem)] max-w-[56rem]"
      footer={ready ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <a
            href={metadata.data?.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
          >
            <ExternalLink size={16} aria-hidden />
            Open verification link
          </a>
          <a
            href={url}
            download="final-defense-certificate.pdf"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--college-on-primary)] hover:bg-[var(--color-primary-dark)] focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
          >
            <Download size={17} aria-hidden />
            Download PDF
          </a>
        </div>
      ) : undefined}
    >
      {error ? (
        <p role="alert" className="text-[var(--color-text-secondary)]">{error.message}</p>
      ) : url && metadata.data ? (
        <>
          <dl className="sr-only">
            <dt>College</dt><dd>{metadata.data.collegeName}</dd>
            <dt>Research title</dt><dd>{metadata.data.researchTitle}</dd>
            <dt>Award date</dt><dd>{awardDate.format(new Date(metadata.data.awardedAt))}</dd>
            <dt>Research Coordinator</dt><dd>{metadata.data.coordinator}</dd>
            <dt>Dean of the Department</dt><dd>{metadata.data.dean}</dd>
          </dl>
          <Suspense fallback={<p role="status">Loading certificate preview…</p>}>
            <div className="[&_[data-rendering=true]_canvas]:invisible">
              <PdfPreview url={url} compact />
            </div>
          </Suspense>
        </>
      ) : (
        <p role="status" className="text-[var(--color-text-secondary)]">Loading certificate…</p>
      )}
    </Modal>
  );
}
