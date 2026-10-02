"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdvisers } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";

type RequestMethod = "details" | "pdf";

export default function AdviserPoolPage() {
  const { data, isPending, isError, refetch } = useAdvisers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdviser, setSelectedAdviser] = useState<any | null>(null);
  const [requestMethod, setRequestMethod] = useState<RequestMethod>("details");
  const [contactName, setContactName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberNames, setMemberNames] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestPdf, setRequestPdf] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openRequest = (adviser: any) => {
    const project = data?.project;
    setSelectedAdviser(adviser);
    setRequestMethod("details");
    setContactName(`${user?.firstName || ""} ${user?.lastName || ""}`.trim());
    setGroupName(project?.title || "");
    setMemberNames((project?.members || []).filter((member: any) => member.projectRole !== "ADVISER" && !member.leftAt).map((member: any) => `${member.user?.firstName || ""} ${member.user?.lastName || ""}`.trim()).filter(Boolean).join(", "));
    setRequestNote("");
    setRequestPdf(null);
    setMessage(null);
  };

  const closeRequest = () => {
    setSelectedAdviser(null);
    setRequestPdf(null);
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!data?.projectId || !selectedAdviser?.id) throw new Error("Register a research project before requesting an adviser.");
      if (requestMethod === "details" && (!contactName.trim() || !groupName.trim() || !memberNames.trim())) throw new Error("Contact name, group name, and group members are required.");
      if (requestMethod === "pdf" && !requestPdf) throw new Error("Select the completed adviser request form in PDF format.");

      let requestFormDocumentId: string | undefined;
      if (requestMethod === "pdf" && requestPdf) {
        const formData = new FormData();
        formData.append("file", requestPdf);
        formData.append("title", `Adviser Request Form - ${data.project?.title || groupName || "Research Group"}`);
        formData.append("documentType", "ADVISER_REQUEST_FORM");
        const token = localStorage.getItem("advisio_token");
        const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const response = await fetch(`${apiBase}/api/research/${data.projectId}/documents`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData });
        const upload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(upload.error || "Unable to upload the adviser request form.");
        requestFormDocumentId = upload.document?.id;
      }

      const structuredNote = requestMethod === "details"
        ? [`Contact name: ${contactName.trim()}`, `Group name: ${groupName.trim()}`, `Members: ${memberNames.trim()}`, requestNote.trim() ? `Message: ${requestNote.trim()}` : ""].filter(Boolean).join("\n")
        : requestNote.trim() || "Completed adviser request form attached as PDF.";

      return apiClient.post("/api/adviser-requests", { researchId: data.projectId, adviserId: selectedAdviser.id, note: structuredNote, requestFormDocumentId });
    },
    onSuccess: async () => {
      setMessage("Your adviser request was sent successfully.");
      closeRequest();
      await queryClient.invalidateQueries({ queryKey: ["student", "advisers"] });
    },
    onError: (error: any) => setMessage(error?.message || "Unable to send adviser request."),
  });

  if (isPending) return <PageSkeleton />;
  if (isError || !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Unable to load verified advisers. <button onClick={() => refetch()} className="ml-2 font-extrabold underline">Retry</button></div>;

  const { assigned, available, project } = data;
  return (
    <main className="flex flex-col gap-5 p-5 lg:p-6">
      <section className="rounded-2xl bg-gradient-to-r from-[#173f63] to-[#245a85] p-6 text-white shadow-sm">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#f6a800]">Faculty matching</p>
        <h1 className="mt-1 text-2xl font-black">Verified Adviser Pool</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">Review verified faculty accounts and submit a formal request using group details or your completed institutional PDF form.</p>
      </section>

      {!project && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"><i className="ti ti-alert-circle mr-2" />Register a research project before sending an adviser request.</div>}
      {message && !selectedAdviser && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">{message}</div>}
      {assigned && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Assigned adviser</p><div className="mt-3 flex items-center gap-3"><Avatar initials={assigned.initials} colorVariant="info" size="lg" /><div><p className="font-extrabold text-[#102f49]">{assigned.name}</p><p className="text-xs text-slate-600">{assigned.college} · {assigned.email}</p></div><Tag variant="success">Assigned</Tag></div></section>}

      <section>
        <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-extrabold text-[#102f49]">Available verified advisers</h2><p className="text-xs text-slate-500">Active institutional accounts with the Adviser role, including the demo adviser.</p></div><span className="text-xs font-bold text-slate-500">{available.length} verified</span></div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {available.map((adviser: any) => <article key={adviser.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#f6a800]"><div className="flex items-start gap-3"><Avatar initials={adviser.initials} colorVariant={adviser.colorVariant ?? "info"} size="lg" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-[#102f49]">{adviser.name}</h3><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700"><i className="ti ti-rosette-discount-check mr-1" />Verified</span>{adviser.email === "adviser01@university.edu.ph" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">Demo adviser</span>}</div><p className="mt-1 text-xs text-slate-500">{adviser.college}</p><p className="mt-0.5 truncate text-xs text-slate-400">{adviser.email}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">{adviser.adviseeCount} active advisees</span>{adviser.isFull ? <Tag variant="warn">Full</Tag> : adviser.requestStatus === "PENDING" ? <Tag variant="info">Request pending</Tag> : adviser.requestStatus === "ACCEPTED" ? <Tag variant="success">Accepted</Tag> : <button onClick={() => openRequest(adviser)} disabled={!project || Boolean(assigned)} className="rounded-xl bg-[#f6a800] px-4 py-2 text-xs font-extrabold text-[#102f49] disabled:cursor-not-allowed disabled:opacity-50">Request adviser</button>}</div></article>)}
          {!available.length && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No verified advisers are currently available.</div>}
        </div>
      </section>

      {selectedAdviser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="adviser-request-title"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="adviser-request-title" className="text-xl font-extrabold text-[#102f49]">Request {selectedAdviser.name}</h2><p className="mt-1 text-sm text-slate-500">Choose how you want to submit the formal request.</p></div><button onClick={closeRequest} aria-label="Close adviser request" className="text-slate-400 hover:text-slate-700"><i className="ti ti-x text-xl" /></button></div>
        <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setRequestMethod("details")} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${requestMethod === "details" ? "bg-white text-[#102f49] shadow-sm" : "text-slate-500"}`}><i className="ti ti-forms mr-1" />Fill in details</button><button onClick={() => setRequestMethod("pdf")} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${requestMethod === "pdf" ? "bg-white text-[#102f49] shadow-sm" : "text-slate-500"}`}><i className="ti ti-file-type-pdf mr-1" />Upload PDF form</button></div>
        {requestMethod === "details" ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Representative name" value={contactName} onChange={setContactName} /><Field label="Group / research name" value={groupName} onChange={setGroupName} /><label className="sm:col-span-2 text-xs font-bold text-slate-700">Group members<textarea value={memberNames} onChange={(e) => setMemberNames(e.target.value)} rows={3} placeholder="Separate names with commas" className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-[#173f63]" /></label></div> : <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center transition hover:border-[#f6a800]"><i className="ti ti-file-upload text-3xl text-[#173f63]" /><span className="mt-2 text-sm font-extrabold text-[#102f49]">{requestPdf?.name || "Select completed adviser request form"}</span><span className="mt-1 text-xs text-slate-500">PDF only, maximum 10 MB</span><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0] || null; if (file && (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024)) { setMessage("The request form must be a PDF no larger than 10 MB."); setRequestPdf(null); } else { setMessage(null); setRequestPdf(file); } }} /></label>}
        <label className="mt-4 block text-xs font-bold text-slate-700">Message to adviser <span className="font-normal text-slate-400">(optional)</span><textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} maxLength={1000} rows={4} placeholder="Explain why this adviser is a good match for your research." className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-[#173f63]" /></label>{message && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{message}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={closeRequest} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending} className="rounded-xl bg-[#f6a800] px-5 py-2 text-sm font-extrabold text-[#102f49] disabled:opacity-60">{applyMutation.isPending ? "Submitting…" : "Submit adviser request"}</button></div></div></div>}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-slate-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-[#173f63]" /></label>;
}

function PageSkeleton() {
  return <div className="space-y-4 p-6"><div className="h-36 animate-pulse rounded-2xl bg-slate-200" /><div className="grid gap-4 md:grid-cols-2"><div className="h-36 animate-pulse rounded-2xl bg-slate-200" /><div className="h-36 animate-pulse rounded-2xl bg-slate-200" /></div></div>;
}
