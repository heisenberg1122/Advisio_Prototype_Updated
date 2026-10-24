import { useEffect, useRef, useState } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiClient } from "@/lib/api-client";
import { SignaturePad } from "./SignaturePad";
import { useAuth } from "@/providers/auth-provider";
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
const absoluteApiUrl = (value: string) =>
  value.startsWith("/") ? `${apiBase}${value}` : value;
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
  const { user } = useAuth();
  const signerName = [user?.firstName, user?.middleName, user?.lastName]
    .filter(Boolean)
    .join(" ");
  const [mode, setMode] = useState<"saved" | "draw" | "upload" | "type">(
    "saved",
  );
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [saveSignature, setSaveSignature] = useState(false);
  const [result, setResult] = useState<DocumentSigningResult | null>(null);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [signedPreview, setSignedPreview] = useState(false);
  const uploadGeneration = useRef(0);
  const successRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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
  const [savedSignatureUrl, setSavedSignatureUrl] = useState("");
  const signatureUrl = mode === "saved" ? savedSignatureUrl : draftImage || "";
  const [position, setPosition] = useState({
    x: 0.62,
    y: 0.72,
    width: 0.25,
    height: 0.09,
  });
  const [includeName, setIncludeName] = useState(true);
  const [includeDate, setIncludeDate] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = async () => {
    const data = await apiClient.get<{ signature: SignatureProfile | null }>(
      "/api/users/me/signature",
    );
    setProfile(data.signature);
    if (!data.signature) {
      setSavedSignatureUrl("");
      setMode("draw");
      return;
    }
    const response = await fetch(absoluteApiUrl(data.signature.imageUrl), {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error("Unable to load your saved signature.");
    setSavedSignatureUrl(URL.createObjectURL(await response.blob()));
  };

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;
    setBusy(true);
    Promise.all([
      fetch(absoluteApiUrl(document.fileUrl), { headers: authHeaders() }).then(
        async (response) => {
          if (!response.ok) throw new Error("Unable to load the selected PDF.");
          return response.arrayBuffer();
        },
      ),
      loadProfile(),
    ])
      .then(async ([data]) => {
        loadedPdf = await getDocument({ data }).promise;
        if (active) setPdf(loadedPdf);
      })
      .catch(
        (reason) =>
          active &&
          setError(reason.message || "Unable to prepare the signing screen."),
      )
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
      loadedPdf?.cleanup();
    };
    // The selected version is immutable while this modal is open.
  }, [document.versionId]);

  useEffect(
    () => () => {
      if (savedSignatureUrl) URL.revokeObjectURL(savedSignatureUrl);
    },
    [savedSignatureUrl],
  );

  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    setConfirmed(false);
  }, [mode, draftImage, pageNumber, position, includeName, includeDate]);

  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  const close = () => {
    if (saving) return;
    if (result)
      onSigned(
        `Document signed successfully. Verification: ${result.signature.verificationCode}`,
        result,
      );
    else onClose();
  };

  const signedFileUrl = result
    ? document.signUrl?.includes("/official-copies/")
      ? `/api/official-copies/files/${result.version.googleDriveFileId || result.version.id}`
      : document.signUrl?.includes("/attachments/")
        ? `/api/mail/attachments/${result.version.id}`
        : `/api/documents/versions/${result.version.id}/content`
    : "";

  useEffect(() => {
    if (!signedFileUrl) return;
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    fetch(absoluteApiUrl(signedFileUrl), { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Signed copy saved. Use Download signed copy to retry opening it.",
          );
        loaded = await getDocument({ data: await response.arrayBuffer() })
          .promise;
        if (active) {
          setPdf(loaded);
          setSignedPreview(true);
        } else loaded.cleanup();
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
      loaded?.cleanup();
    };
  }, [signedFileUrl]);

  const downloadCopy = async () => {
    try {
      const blob = await apiClient.file(signedFileUrl);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = result!.version.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason: any) {
      setError(reason.message || "Unable to download the signed PDF.");
    }
  };

  useEffect(() => {
    if (!previewRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setPreviewSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    let renderTask:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const natural = page.getViewport({ scale: 1 });
      setPageSize({ width: natural.width, height: natural.height });
      const availableWidth = Math.max(240, previewSize.width - 40);
      const availableHeight = Math.max(240, previewSize.height - 92);
      const scale =
        fitMode === "width"
          ? availableWidth / natural.width
          : fitMode === "page"
            ? Math.min(
                availableWidth / natural.width,
                availableHeight / natural.height,
              )
            : 1.25 * zoom;
      const viewport = page.getViewport({
        scale: Math.max(0.35, Math.min(3, scale)),
      });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({ canvas, canvasContext: context, viewport });
      renderTask.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoom, fitMode, previewSize]);

  const changeZoom = (next: number) => {
    setFitMode("custom");
    setZoom(Math.max(0.4, Math.min(2.4, next)));
  };

  const uploadSignature = async (file?: File) => {
    if (!file) return;
    setError("");
    setDraftImage(null);
    const generation = ++uploadGeneration.current;
    if (file.type !== "image/png" || file.size > 2 * 1024 * 1024) {
      setError("Choose a PNG signature up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        if (generation !== uploadGeneration.current) return;
        if (
          image.width > 4096 ||
          image.height > 4096 ||
          image.width * image.height > 4_000_000
        ) {
          setError(
            "Use a signature up to 4 million pixels and 4096 pixels per side.",
          );
          return;
        }
        setDraftImage(reader.result as string);
      };
      image.onerror = () => setError("The PNG image could not be read.");
      image.src = reader.result as string;
    };
    reader.onerror = () => setError("Unable to read this file.");
    reader.readAsDataURL(file);
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (saving || result) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      saving ||
      result ||
      !event.currentTarget.hasPointerCapture(event.pointerId) ||
      !pageRef.current
    )
      return;
    const bounds = pageRef.current.getBoundingClientRect();
    const x =
      (event.clientX - bounds.left - dragOffset.current.x) / bounds.width;
    const y =
      (event.clientY - bounds.top - dragOffset.current.y) / bounds.height;
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
        document.signUrl ||
          `/api/documents/versions/${document.versionId}/sign`,
        {
          password,
          confirmation: confirmed,
          ...(mode !== "saved"
            ? { signatureImage: draftImage, saveSignature }
            : {}),
          placements: [{ pageNumber, ...position, includeName, includeDate }],
        },
      );
      setResult(result);
      setPassword("");
      pageRef.current
        ?.querySelector<HTMLElement>(
          '[aria-label="Signature position. Drag or use arrow keys to move."]',
        )
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "nearest",
        });
    } catch (reason: any) {
      setError(reason.message || "Unable to sign the document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
        if (event.key === "Tab") {
          const items = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ) || [],
          ).filter((item) => item.getClientRects().length);
          const first = items[0],
            last = items[items.length - 1];
          if (
            event.shiftKey &&
            (window.document.activeElement === first ||
              window.document.activeElement === dialogRef.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            window.document.activeElement === last
          ) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
      className="fixed inset-0 z-[90] flex bg-slate-950/70 p-2 sm:p-3 backdrop-blur-sm [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#173f63]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-document-title"
    >
      <style>{`@keyframes advisio-signature-check { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } } @media (prefers-reduced-motion: no-preference) { .advisio-signature-check { stroke-dasharray: 1; animation: advisio-signature-check 600ms ease-out both; } }`}</style>
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2
              id="sign-document-title"
              className="truncate text-lg font-extrabold text-[#102f49]"
            >
              Sign {document.docName}
            </h2>
            <p className="text-base text-slate-500">
              {document.groupName} · Drag your signature to the exact location.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${result ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
          >
            {result ? "Signed" : "Awaiting signature"}
          </span>
          <button
            disabled={saving}
            onClick={close}
            aria-label="Close signing screen"
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl text-slate-600"
          >
            <i className="ti ti-x" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(260px,45dvh)_auto] overflow-y-auto min-[760px]:grid-cols-[minmax(0,1fr)_380px] min-[760px]:grid-rows-1 min-[760px]:overflow-hidden">
          <div
            ref={previewRef}
            className="relative min-h-0 overflow-auto bg-slate-200 p-5 pt-16"
          >
            <div className="sticky top-0 z-20 -mt-11 mb-3 flex w-fit items-center gap-1 rounded-xl border border-slate-300 bg-white/95 p-1.5 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={() => changeZoom(zoom - 0.1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <i className="ti ti-zoom-out" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1)}
                className={`min-w-14 rounded-lg px-2 py-1.5 text-sm font-extrabold ${fitMode === "custom" && zoom === 1 ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                title="Reset zoom"
              >
                {fitMode === "custom" ? `${Math.round(zoom * 100)}%` : "100%"}
              </button>
              <button
                type="button"
                onClick={() => changeZoom(zoom + 0.1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <i className="ti ti-zoom-in" />
              </button>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => setFitMode("width")}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-extrabold ${fitMode === "width" ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Fit width
              </button>
              <button
                type="button"
                onClick={() => setFitMode("page")}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-extrabold ${fitMode === "page" ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Fit page
              </button>
            </div>
            {busy && (
              <DocumentPreviewSkeleton className="h-full min-h-[560px]" />
            )}
            {!busy && pdf && (
              <div
                ref={pageRef}
                className="relative mx-auto w-fit bg-white shadow-xl"
              >
                <canvas ref={canvasRef} className="block max-w-none" />
                {signatureUrl && !signedPreview && (
                  <div
                    onPointerDown={beginDrag}
                    onPointerMove={drag}
                    onPointerUp={(event) => {
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                    }}
                    tabIndex={result ? -1 : 0}
                    role="button"
                    aria-label="Signature position. Drag or use arrow keys to move."
                    onKeyDown={(event) => {
                      const direction = {
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                      }[event.key];
                      if (!direction || saving || result) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setPosition((current) => ({
                        ...current,
                        x: Math.max(
                          0,
                          Math.min(
                            1 - current.width,
                            current.x + direction[0] * 0.005,
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            1 - current.height,
                            current.y + direction[1] * 0.005,
                          ),
                        ),
                      }));
                    }}
                    className="absolute cursor-move touch-none outline outline-1 outline-dashed outline-[#173f63] focus-visible:ring-2 focus-visible:ring-[#173f63]"
                    style={{
                      left: `${position.x * 100}%`,
                      top: `${position.y * 100}%`,
                      width: `${position.width * 100}%`,
                      height: `${position.height * 100}%`,
                    }}
                    title="Drag signature"
                  >
                    <img
                      src={signatureUrl}
                      alt="Your signature"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                )}
                {signatureUrl && !signedPreview && (
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
                  >
                    {[
                      includeName ? signerName : null,
                      includeDate
                        ? `Signed ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date())}`
                        : null,
                    ]
                      .filter(Boolean)
                      .map((line, index) => (
                        <text
                          key={index}
                          x={position.x * pageSize.width}
                          y={Math.min(
                            pageSize.height - 4,
                            (position.y + position.height) * pageSize.height +
                              10 +
                              index * 9,
                          )}
                          fontSize="7"
                          fontFamily="Arial, Helvetica, sans-serif"
                          fill="#1f2e40"
                        >
                          {line}
                        </text>
                      ))}
                  </svg>
                )}
              </div>
            )}
          </div>
          <aside className="min-h-0 border-t bg-white p-5 min-[760px]:overflow-y-auto min-[760px]:border-l min-[760px]:border-t-0">
            {error && (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {error}
              </div>
            )}
            <ol
              aria-label="Signing progress"
              className="mb-5 flex justify-between text-xs font-bold text-[#173f63]"
            >
              {["Read", "Sign", "Done"].map((step, index) => (
                <li
                  key={step}
                  aria-current={index === (result ? 2 : 1) ? "step" : undefined}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full ${result || index < 2 ? "bg-[#173f63] text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {result ? (
              <section
                ref={successRef}
                tabIndex={-1}
                aria-live="polite"
                className="space-y-4 py-5 text-center"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="mx-auto h-16 w-16 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    pathLength="1"
                    className="advisio-signature-check"
                  />
                  <path
                    d="m19 32 9 9 18-19"
                    pathLength="1"
                    className="advisio-signature-check"
                  />
                </svg>
                <h3 className="text-xl font-extrabold text-[#102f49]">
                  Document signed
                </h3>
                <p className="text-base text-slate-600">
                  Your signed PDF has been saved successfully.
                </p>
                <p className="break-all text-base text-slate-500">
                  Verification: {result.signature.verificationCode}
                </p>
                <button
                  type="button"
                  onClick={downloadCopy}
                  className="w-full rounded-xl bg-[#173f63] px-4 py-3 text-sm font-bold text-white"
                >
                  Download signed copy
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-[#173f63]"
                >
                  Done
                </button>
              </section>
            ) : (
              <fieldset disabled={saving} className="min-w-0">
                <section>
                  <h3 className="text-lg font-extrabold text-[#102f49]">
                    Review and sign
                  </h3>
                  <p className="mt-1 text-base text-slate-500">
                    Signing as {signerName}. Choose a signature, then place it
                    on the PDF.
                  </p>
                  <div
                    role="group"
                    aria-label="Signature source"
                    className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
                  >
                    {(["saved", "draw", "upload", "type"] as const).map(
                      (value) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={mode === value}
                          disabled={saving || (value === "saved" && !profile)}
                          onClick={() => {
                            uploadGeneration.current++;
                            setMode(value);
                            setDraftImage(null);
                            setSaveSignature(false);
                            setError("");
                          }}
                          className={`rounded-lg px-2 py-2 text-sm font-bold capitalize disabled:opacity-40 ${mode === value ? "bg-white text-[#173f63] shadow-sm" : "text-slate-600"}`}
                        >
                          {value}
                        </button>
                      ),
                    )}
                  </div>
                  {mode === "saved" && (
                    <div className="mt-3 rounded-xl border border-slate-200 p-3">
                      <img
                        src={savedSignatureUrl}
                        alt="Saved signature"
                        className="mx-auto h-20 max-w-full object-contain"
                      />
                      <p className="mt-2 text-center text-base text-slate-400">
                        Private signature · updated{" "}
                        {profile &&
                          new Date(profile.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {(mode === "draw" || mode === "type") && (
                    <SignaturePad
                      key={mode}
                      mode={mode}
                      disabled={saving}
                      onChange={setDraftImage}
                    />
                  )}
                  {mode === "upload" && (
                    <label className="mt-3 block text-sm font-bold text-slate-600">
                      PNG signature, up to 2 MB
                      <input
                        type="file"
                        accept="image/png,.png"
                        disabled={saving}
                        className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-base focus-visible:outline-2"
                        onChange={(event) =>
                          uploadSignature(event.target.files?.[0])
                        }
                      />
                    </label>
                  )}
                  {draftImage && (
                    <img
                      src={draftImage}
                      alt="New signature preview"
                      className="mt-3 h-16 w-full object-contain"
                    />
                  )}
                  {mode !== "saved" && (
                    <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={saveSignature}
                        disabled={saving}
                        onChange={(event) =>
                          setSaveSignature(event.target.checked)
                        }
                      />
                      Save for future use
                      {profile ? " (replaces your saved signature)" : ""}
                    </label>
                  )}
                </section>
                <section className="mt-6 border-t pt-5">
                  <h3 className="text-lg font-extrabold text-[#102f49]">
                    2. Placement
                  </h3>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((value) => value - 1)}
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                    >
                      ‹
                    </button>
                    <span className="flex-1 text-center text-xs font-bold">
                      Page {pageNumber} of {pdf?.numPages || 1}
                    </span>
                    <button
                      disabled={!pdf || pageNumber >= pdf.numPages}
                      onClick={() => setPageNumber((value) => value + 1)}
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                  <label className="mt-4 block text-sm font-bold text-slate-600">
                    Signature size
                    <input
                      type="range"
                      min="0.14"
                      max="0.4"
                      step="0.01"
                      value={position.width}
                      onChange={(event) =>
                        setPosition((current) => {
                          const width = Number(event.target.value);
                          const height = width * 0.36;
                          return {
                            ...current,
                            width,
                            height,
                            x: Math.min(current.x, 1 - width),
                            y: Math.min(current.y, 1 - height),
                          };
                        })
                      }
                      className="mt-2 w-full"
                    />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={includeName}
                      onChange={(event) => setIncludeName(event.target.checked)}
                    />
                    Include printed name
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={includeDate}
                      onChange={(event) => setIncludeDate(event.target.checked)}
                    />
                    Include signing date
                  </label>
                </section>
                <section className="mt-6 border-t pt-5">
                  <h3 className="text-lg font-extrabold text-[#102f49]">
                    3. Confirm and sign
                  </h3>
                  <label className="mt-3 block text-sm font-bold text-slate-600">
                    Confirm your password
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#173f63]"
                    />
                  </label>
                  <label className="mt-3 flex items-start gap-2 text-sm leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I reviewed this exact PDF version and authorize Advisio to
                      apply my electronic signature.
                    </span>
                  </label>
                  <button
                    onClick={signDocument}
                    disabled={
                      saving ||
                      busy ||
                      !pdf ||
                      !signatureUrl ||
                      !password ||
                      !confirmed
                    }
                    className="mt-4 w-full rounded-xl bg-[#173f63] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Signing securely…" : "Confirm & Sign"}
                  </button>
                  <p className="mt-3 text-base leading-4 text-slate-400">
                    The original remains in version history. Advisio creates a
                    separate signed PDF and records the signer, time, and file
                    hashes.
                  </p>
                </section>
              </fieldset>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible export for the adviser dashboard while the same secure
// signing experience is shared by advisers, professors, panelists, and deans.
export const AdviserDocumentSigningModal = DocumentSigningModal;
