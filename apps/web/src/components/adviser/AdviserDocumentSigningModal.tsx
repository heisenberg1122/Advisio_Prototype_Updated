import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiClient } from "@/lib/api-client";
import { DocumentPreviewSkeleton } from "@/components/ui/Skeleton";

GlobalWorkerOptions.workerSrc = pdfWorker;

type SigningDocument = {
  versionId: string;
  docName: string;
  groupName: string;
  fileUrl: string;
  signUrl?: string;
};

type SignatureProfile = {
  id: string;
  imageUrl: string;
  updatedAt: string;
};

export type DocumentSigningResult = {
  signature: { verificationCode: string };
  version: { id: string; fileName: string; googleDriveFileId?: string | null };
};

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const absoluteApiUrl = (value: string) => value.startsWith("/") ? `${apiBase}${value}` : value;
const authHeaders = () => {
  const token = localStorage.getItem("advisio_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function DocumentSigningModal({
  document,
  onClose,
  onSigned,
}: {
  document: SigningDocument;
  onClose: () => void;
  onSigned: (message: string, result: DocumentSigningResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"custom" | "width" | "page">("width");
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [profile, setProfile] = useState<SignatureProfile | null>(null);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [position, setPosition] = useState({ x: 0.62, y: 0.72, width: 0.25, height: 0.09 });
  const [includeName, setIncludeName] = useState(true);
  const [includeDate, setIncludeDate] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = async () => {
    const data = await apiClient.get<{ signature: SignatureProfile | null }>("/api/users/me/signature");
    setProfile(data.signature);
    if (!data.signature) {
      setSignatureUrl("");
      return;
    }
    const response = await fetch(absoluteApiUrl(data.signature.imageUrl), { headers: authHeaders() });
    if (!response.ok) throw new Error("Unable to load your saved signature.");
    setSignatureUrl(URL.createObjectURL(await response.blob()));
  };

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;
    setBusy(true);
    Promise.all([
      fetch(absoluteApiUrl(document.fileUrl), { headers: authHeaders() }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the selected PDF.");
        return response.arrayBuffer();
      }),
      loadProfile(),
    ])
      .then(async ([data]) => {
        loadedPdf = await getDocument({ data }).promise;
        if (active) setPdf(loadedPdf);
      })
      .catch((reason) => active && setError(reason.message || "Unable to prepare the signing screen."))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
      loadedPdf?.cleanup();
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    };
    // The selected version is immutable while this modal is open.
  }, [document.versionId]);

  useEffect(() => {
    if (!previewRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setPreviewSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const natural = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, previewSize.width - 40);
      const availableHeight = Math.max(240, previewSize.height - 92);
      const scale = fitMode === "width"
        ? availableWidth / natural.width
        : fitMode === "page"
          ? Math.min(availableWidth / natural.width, availableHeight / natural.height)
          : 1.25 * zoom;
      const viewport = page.getViewport({ scale: Math.max(0.35, Math.min(3, scale)) });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      page.render({ canvas, canvasContext: context, viewport }).promise.catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [pdf, pageNumber, zoom, fitMode, previewSize]);

  const changeZoom = (next: number) => {
    setFitMode("custom");
    setZoom(Math.max(0.4, Math.min(2.4, next)));
  };

  const uploadSignature = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("signature", file);
      const response = await fetch(absoluteApiUrl("/api/users/me/signature"), {
        method: "PUT",
        headers: authHeaders(),
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save the signature.");
      await loadProfile();
    } catch (reason: any) {
      setError(reason.message || "Unable to save the signature.");
    } finally {
      setSaving(false);
    }
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !pageRef.current) return;
    const bounds = pageRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left - dragOffset.current.x) / bounds.width;
    const y = (event.clientY - bounds.top - dragOffset.current.y) / bounds.height;
    setPosition((current) => ({
      ...current,
      x: Math.max(0, Math.min(1 - current.width, x)),
      y: Math.max(0, Math.min(1 - current.height, y)),
    }));
  };

  const signDocument = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await apiClient.post<DocumentSigningResult>(
        document.signUrl || `/api/documents/versions/${document.versionId}/sign`,
        {
          password,
          confirmation: confirmed,
          placements: [{ pageNumber, ...position, includeName, includeDate }],
        },
      );
      onSigned(`Document signed successfully. Verification: ${result.signature.verificationCode}`, result);
    } catch (reason: any) {
      setError(reason.message || "Unable to sign the document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sign-document-title">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0"><h2 id="sign-document-title" className="truncate text-lg font-extrabold text-[#102f49]">Sign {document.docName}</h2><p className="text-xs text-slate-500">{document.groupName} · Drag your signature to the exact location.</p></div>
          <button onClick={onClose} aria-label="Close signing screen" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl text-slate-600"><i className="ti ti-x" /></button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
          <div ref={previewRef} className="relative min-h-0 overflow-auto bg-slate-200 p-5 pt-16">
            <div className="sticky top-0 z-20 -mt-11 mb-3 flex w-fit items-center gap-1 rounded-xl border border-slate-300 bg-white/95 p-1.5 shadow-lg backdrop-blur">
              <button type="button" onClick={() => changeZoom(zoom - 0.1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Zoom out" title="Zoom out"><i className="ti ti-zoom-out" /></button>
              <button type="button" onClick={() => changeZoom(1)} className={`min-w-14 rounded-lg px-2 py-1.5 text-xs font-extrabold ${fitMode === "custom" && zoom === 1 ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`} title="Reset zoom">{fitMode === "custom" ? `${Math.round(zoom * 100)}%` : "100%"}</button>
              <button type="button" onClick={() => changeZoom(zoom + 0.1)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Zoom in" title="Zoom in"><i className="ti ti-zoom-in" /></button>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button type="button" onClick={() => setFitMode("width")} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ${fitMode === "width" ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`}>Fit width</button>
              <button type="button" onClick={() => setFitMode("page")} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ${fitMode === "page" ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`}>Fit page</button>
            </div>
            {busy && <DocumentPreviewSkeleton className="h-full min-h-[560px]" />}
            {!busy && pdf && <div ref={pageRef} className="relative mx-auto w-fit bg-white shadow-xl">
              <canvas ref={canvasRef} className="block max-w-none" />
              {signatureUrl && <div
                onPointerDown={beginDrag}
                onPointerMove={drag}
                className="absolute cursor-move touch-none border-2 border-dashed border-amber-500 bg-amber-50/30 p-1"
                style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, width: `${position.width * 100}%`, height: `${position.height * 100}%` }}
                title="Drag signature"
              ><img src={signatureUrl} alt="Your saved signature" className="h-full w-full object-contain" draggable={false} /></div>}
            </div>}
          </div>
          <aside className="min-h-0 overflow-y-auto border-l bg-white p-5">
            {error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
            <section><h3 className="text-sm font-extrabold text-[#102f49]">1. Your signature</h3>
              {profile ? <div className="mt-3 rounded-xl border border-slate-200 p-3"><img src={signatureUrl} alt="Saved signature" className="mx-auto h-20 max-w-full object-contain" /><p className="mt-2 text-center text-[10px] text-slate-400">Private signature · updated {new Date(profile.updatedAt).toLocaleDateString()}</p></div> : <p className="mt-2 text-xs leading-5 text-slate-500">Upload a transparent PNG of your signature. It remains private and can only be applied after your confirmation.</p>}
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-extrabold text-[#173f63]">{profile ? "Replace signature" : "Upload PNG signature"}<input type="file" accept="image/png,.png" className="hidden" onChange={(event) => uploadSignature(event.target.files?.[0])} /></label>
            </section>
            <section className="mt-6 border-t pt-5"><h3 className="text-sm font-extrabold text-[#102f49]">2. Placement</h3>
              <div className="mt-3 flex items-center gap-2"><button disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">‹</button><span className="flex-1 text-center text-xs font-bold">Page {pageNumber} of {pdf?.numPages || 1}</span><button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">›</button></div>
              <label className="mt-4 block text-xs font-bold text-slate-600">Signature size<input type="range" min="0.14" max="0.4" step="0.01" value={position.width} onChange={(event) => setPosition((current) => { const width = Number(event.target.value); const height = width * 0.36; return { ...current, width, height, x: Math.min(current.x, 1 - width), y: Math.min(current.y, 1 - height) }; })} className="mt-2 w-full" /></label>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={includeName} onChange={(event) => setIncludeName(event.target.checked)} />Include printed name</label>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={includeDate} onChange={(event) => setIncludeDate(event.target.checked)} />Include signing date</label>
            </section>
            <section className="mt-6 border-t pt-5"><h3 className="text-sm font-extrabold text-[#102f49]">3. Confirm and sign</h3>
              <label className="mt-3 block text-xs font-bold text-slate-600">Confirm your password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#173f63]" /></label>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" /><span>I reviewed this exact PDF version and authorize Advisio to apply my electronic signature.</span></label>
              <button onClick={signDocument} disabled={saving || !profile || !password || !confirmed} className="mt-4 w-full rounded-xl bg-[#173f63] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Signing securely…" : "Confirm & Sign"}</button>
              <p className="mt-3 text-[10px] leading-4 text-slate-400">The original remains in version history. Advisio creates a separate signed PDF and records the signer, time, and file hashes.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible export for the adviser dashboard while the same secure
// signing experience is shared by advisers, professors, panelists, and deans.
export const AdviserDocumentSigningModal = DocumentSigningModal;
