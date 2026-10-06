import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

const guidance: Record<string, { title: string; text: string }> = {
  ADVISER: { title: "Adviser endorsement", text: "Sign only after completing the review and confirming the manuscript is ready for its next approval gate." },
  RESEARCH_COORDINATOR: { title: "Professor milestone clearance", text: "Sign after the required milestone evidence is complete and your academic decision has been recorded." },
  PANELIST: { title: "Panel evaluation confirmation", text: "Sign the final evaluation or decision copy only after scores and recommendations are submitted and locked." },
  RPO: { title: "Dean institutional approval", text: "Sign only after all prerequisite endorsements are present and the college-level decision is final." },
  VPAA: { title: "Dean institutional approval", text: "Sign only after all prerequisite endorsements are present and the institutional decision is final." },
};

export default function SignatureCenterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["signature-center-projects"], queryFn: () => apiClient.get<{ projects: any[] }>("/api/research") });
  const role = user?.roles?.find((item: string) => guidance[item]) || "ADVISER";
  const documents = useMemo(() => (data?.projects || []).flatMap((project: any) =>
    (project.taskSubmissions || []).flatMap((submission: any) => {
      const document = submission.document;
      const version = document?.versions?.find((item: any) => item.versionNumber === document.currentVersion) || document?.versions?.[0];
      return version?.mimeType === "application/pdf" && version?.googleDriveFileId ? [{ project, document, version }] : [];
    })), [data]);

  return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
    {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(value) => { setSigningDocument(null); setMessage(value); queryClient.invalidateQueries({ queryKey: ["signature-center-projects"] }); }} />}
    <section className="rounded-2xl bg-[#0B3A53] p-6 text-white shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#f6a800]">Secure signature center</p><h1 className="mt-2 text-2xl font-black">{guidance[role].title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{guidance[role].text} Every signature requires your password and creates a new immutable PDF version with a verification code and audit record.</p></section>
    {message && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-end justify-between gap-3"><div><h2 className="font-extrabold text-[#102f49]">Eligible PDF submissions</h2><p className="mt-1 text-xs text-slate-500">Open the exact version, place your signature, and confirm only when your decision is final.</p></div><span className="text-xs font-bold text-slate-400">{documents.length} files</span></div>
      <div className="mt-4 space-y-3">{isLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading documents…</p> : documents.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No PDF submissions are currently available in your assigned scope.</p> : documents.map(({ project, document, version }: any) => <article key={version.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#102f49]">{document.title}</h3><p className="mt-1 truncate text-xs text-slate-500">{project.title} · {version.fileName}</p>{version.signedSignature && <p className="mt-1 text-[11px] font-bold text-emerald-700">Latest copy includes a prior signature · countersigning will preserve it</p>}</div><button type="button" onClick={() => setSigningDocument({ versionId: version.id, docName: document.title, groupName: project.title, fileUrl: `/api/documents/files/${version.googleDriveFileId}` })} className="shrink-0 rounded-xl bg-[#173f63] px-4 py-2.5 text-xs font-extrabold text-white"><i className="ti ti-signature mr-1.5" />Review & sign</button></article>)}</div>
    </section>
  </div>;
}
