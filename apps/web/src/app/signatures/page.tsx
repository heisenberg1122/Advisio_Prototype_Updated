import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { apiClient } from "@/lib/api-client";
import { FilesPageSkeleton, MailPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";
import { EmptyNote, InlineFeedback, StatusDot } from "@/components/ui/advisio";
import { RoleBand, SearchField, initials } from "@/components/dashboards/RoleScreenParts";
import "@/components/profile/faculty-profile.css";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type InboxMessage = {
  id: string;
  documentId: string;
  message: string;
  createdAt: string;
  author: { id: string; firstName: string; middleName?: string | null; lastName: string };
  attachmentVersion?: { id: string; fileName: string; googleDriveFileId?: string | null; versionNumber: number } | null;
};

type DeanInboxThread = {
  id: string;
  title: string;
  currentVersion: number;
  research: { id: string; title: string; groupName?: string | null };
  versions: any[];
  deanInboxMessages: Array<{ author: InboxMessage["author"]; message: string; createdAt: string }>;
};

const guidance: Record<string, { title: string; text: string }> = {
  ADVISER: { title: "Adviser endorsement", text: "Sign only after completing the review and confirming the manuscript is ready for its next approval gate." },
  RESEARCH_COORDINATOR: { title: "Professor milestone clearance", text: "Sign after the required milestone evidence is complete and your academic decision has been recorded." },
  PANELIST: { title: "Panel evaluation confirmation", text: "Sign the final evaluation or decision copy only after scores and recommendations are submitted and locked." },
};

async function openFile(versionId?: string | null) {
  if (!versionId) return;
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}/api/documents/versions/${versionId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Unable to open this document.");
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function SignatureCenterPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDean = Boolean(user?.roles?.some((role: string) => ["DEAN"].includes(role)));
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState(params.get("documentId") || "");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [notice, setNotice] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["signature-center-projects"], queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"), enabled: !isDean });
  const { data: messageData } = useQuery({
    queryKey: ["dean-inbox-messages"],
    queryFn: () => apiClient.get<{ messages: InboxMessage[] }>("/api/dean-inbox/messages"),
    enabled: isDean,
  });
  const { data: threadData, isLoading: threadsLoading } = useQuery({
    queryKey: ["dean-inbox-threads"],
    queryFn: () => apiClient.get<{ threads: DeanInboxThread[] }>("/api/dean-inbox/threads"),
    enabled: isDean,
  });
  const projectDocuments = useMemo(() => (data?.projects || []).flatMap((project: any) =>
    (project.taskSubmissions || []).flatMap((submission: any) => {
      const document = submission.document;
      const version = document?.versions?.find((item: any) => item.versionNumber === document.currentVersion) || document?.versions?.[0];
      const requestVersion = document?.versions?.find((item: any) => item.sourceSignature) || version;
      return version?.mimeType === "application/pdf" && version?.id ? [{ project, submission, document, version, requestVersion }] : [];
    })), [data]);
  const deanDocuments = useMemo(() => (threadData?.threads || []).flatMap((document) => {
    const version = document.versions.find((item: any) => item.versionNumber === document.currentVersion) || document.versions[0];
    const requestVersion = [...document.versions].sort((a, b) => a.versionNumber - b.versionNumber)[0] || version;
    const firstMessage = document.deanInboxMessages[0];
    return version?.id ? [{ project: document.research, document, version, requestVersion, requester: firstMessage?.author }] : [];
  }), [threadData]);
  const documents = isDean ? deanDocuments : projectDocuments;
  const filtered = documents.filter(({ project, document }: any) => `${project.title} ${document.title}`.toLowerCase().includes(search.toLowerCase()));
  const selected = documents.find(({ document }: any) => document.id === selectedId) || filtered[0] || null;
  const messages = (messageData?.messages || []).filter((item) => item.documentId === selected?.document.id);
  const sendReply = useMutation({
    mutationFn: () => apiClient.post(`/api/dean-inbox/documents/${selected.document.id}/messages`, { message: reply }),
    onSuccess: () => { setReply(""); queryClient.invalidateQueries({ queryKey: ["dean-inbox-messages"] }); },
  });

  if ((isDean && threadsLoading) || (!isDean && isLoading)) {
    return isDean ? <MailPageSkeleton /> : <FilesPageSkeleton />;
  }

  const isSigned = (version: any) => Boolean(version.signedSignature && !version.signedSignature.revokedAt);
  const openSigning = ({ version, document, project }: any) =>
    setSigningDocument({ versionId: version.id, docName: document.title, groupName: project.title, fileUrl: `/api/documents/versions/${version.id}/content` });

  if (!isDean) {
    const role = user?.roles?.find((item: string) => guidance[item]) || "ADVISER";
    return (
      <div className="rs sc-page mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
        {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(value) => { setSigningDocument(null); setNotice(value); queryClient.invalidateQueries({ queryKey: ["signature-center-projects"] }); }} />}
        <RoleBand
          eyebrow="Secure signature center"
          title={guidance[role].title}
          titleId="signature-center-title"
          meta={guidance[role].text}
          counts={[{ label: "Documents", value: documents.length }]}
          countsLabel="Signature summary"
        />
        {notice && <InlineFeedback tone="ok">{notice}</InlineFeedback>}
        {documents.length > 0 && (
          <div className="rs-tools">
            <span />
            <div className="rs-tools-end">
              <SearchField value={search} onChange={setSearch} placeholder="Search document or project" tour={false} />
            </div>
          </div>
        )}
        {filtered.length ? (
          <section className="rh-panel phone-signature-list" style={{ paddingBlock: 6 }} aria-label="Documents to sign">
            <ul className="rh-rows" style={{ marginTop: 0 }}>
              {filtered.map((item: any) => (
                <li key={item.version.id}>
                  <div className="rh-row">
                    <span className="rh-icon" aria-hidden="true"><i className="ti ti-file-text" /></span>
                    <div className="rh-text">
                      <h3>{item.document.title}</h3>
                      <p>{item.project.title} · {item.version.fileName}</p>
                    </div>
                    <button type="button" className="rs-primary" onClick={() => openSigning(item)}>
                      <i className="ti ti-signature" aria-hidden="true" /> Review &amp; sign
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="rs-empty-card">
            <EmptyNote
              layout="row"
              tone={documents.length ? undefined : "ok"}
              icon={documents.length ? "ti-search" : "ti-circle-check"}
              title={documents.length ? "No documents match" : "Nothing to sign right now"}
              text={documents.length ? "Try another search." : "PDF submissions from your groups will appear here."}
            />
          </div>
        )}
      </div>
    );
  }

  const signedCount = documents.filter((item: any) => isSigned(item.version)).length;
  const requesterName = (item: any) => [item?.requester?.firstName, item?.requester?.lastName].filter(Boolean).join(" ") || "Professor";
  const selectedSigned = selected ? isSigned(selected.version) : false;
  const inbox = (
    <div className="sc-inbox">
      {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(value) => { setSigningDocument(null); setNotice(value); queryClient.invalidateQueries({ queryKey: ["signature-center-projects"] }); queryClient.invalidateQueries({ queryKey: ["dean-inbox-threads"] }); queryClient.invalidateQueries({ queryKey: ["dean-inbox-messages"] }); }} />}
      <aside className="sc-list">
        <div className="sc-list-head">
          {embedded && <h1>Signature requests</h1>}
          <SearchField value={search} onChange={setSearch} placeholder="Search requests" tour={false} />
        </div>
        <div className="sc-list-scroll">
          {threadsLoading ? (
            <p className="rs-note" style={{ padding: 20, textAlign: "center" }}>Loading inbox…</p>
          ) : filtered.length === 0 ? (
            <EmptyNote layout="row" icon="ti-inbox" title="No signature requests addressed to you" text="Requests sent to another Dean remain in that Dean's private inbox." />
          ) : (
            filtered.map((item: any) => (
              <button key={item.document.id} type="button" className="sc-item" aria-current={item.document.id === selected?.document.id} onClick={() => setSelectedId(item.document.id)}>
                <span className="rs-avatar" data-tone="dark" aria-hidden="true">{initials(item.project.title).slice(0, 2)}</span>
                <span className="rs-text">
                  <strong>{item.document.title}</strong>
                  <small>{item.project.title}</small>
                  <small>From {requesterName(item)} · {new Date(item.version.uploadedAt).toLocaleDateString()}</small>
                </span>
                <StatusDot tone={isSigned(item.version) ? "done" : "waiting"}>{isSigned(item.version) ? "Signed" : "Pending"}</StatusDot>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className="sc-pane" aria-label="Signature request">
        {!selected ? (
          <div style={{ margin: "auto" }}><EmptyNote icon="ti-mail" title="Select a request to read it" /></div>
        ) : (
          <>
            <div className="sc-pane-top">
              <div>
                <h2>{selected.document.title}</h2>
                <p>{selected.project.title} · sent by {requesterName(selected)}</p>
              </div>
              {selectedSigned ? (
                <StatusDot tone="done">Signed</StatusDot>
              ) : (
                <button type="button" className="rs-primary" onClick={() => openSigning(selected)}>
                  <i className="ti ti-pencil" aria-hidden="true" /> Add signature
                </button>
              )}
              {selectedSigned && (
                <p className="sc-signed">
                  Signed by {[selected.version.signedSignature.signedBy?.firstName, selected.version.signedSignature.signedBy?.lastName].filter(Boolean).join(" ") || "Dean"} · {new Date(selected.version.signedSignature.signedAt).toLocaleString()} · Verification: {selected.version.signedSignature.verificationCode}
                </p>
              )}
              {notice && <p className="sc-signed">{notice}</p>}
            </div>
            <div className="sc-messages">
              {messages.map((item) => (
                <div key={item.id} className="sc-message" data-mine={item.author.id === user?.id}>
                  <small>{[item.author.firstName, item.author.middleName, item.author.lastName].filter(Boolean).join(" ")} · {new Date(item.createdAt).toLocaleString()}</small>
                  <p>{item.message}</p>
                  {item.attachmentVersion?.id && (
                    <button type="button" className="sc-attachment" onClick={() => openFile(item.attachmentVersion?.id).catch((error) => setNotice(error.message))}>
                      <i className="ti ti-file-text" aria-hidden="true" />
                      <span>{item.attachmentVersion.fileName}</span>
                      <i className="ti ti-download" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <form className="sc-reply" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) sendReply.mutate(); }}>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder='Type a reply, e.g. "I already signed your request. Good luck!"' aria-label="Reply" rows={2} />
              <button type="submit" className="rs-primary" disabled={!reply.trim() || sendReply.isPending} aria-label="Send reply"><i className="ti ti-send" aria-hidden="true" /></button>
            </form>
            {sendReply.isError && <p className="sc-error">{(sendReply.error as Error).message}</p>}
          </>
        )}
      </section>
    </div>
  );

  if (embedded) return <div className="sc-embedded">{inbox}</div>;
  return (
    <div className="rs sc-page mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <RoleBand
        eyebrow="Dean's office"
        title="Signature requests"
        titleId="signature-requests-title"
        meta={documents.length - signedCount ? `${documents.length - signedCount} ${documents.length - signedCount === 1 ? "request is" : "requests are"} waiting for your signature.` : "Nothing is waiting for your signature."}
        counts={[
          { label: "Requests", value: documents.length },
          { label: "Pending", value: documents.length - signedCount, tone: documents.length - signedCount ? "waiting" : undefined },
          { label: "Signed", value: signedCount },
        ]}
        countsLabel="Signature request summary"
      />
      {inbox}
    </div>
  );
}
