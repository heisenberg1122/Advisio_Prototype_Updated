import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  MousePointer2,
  Check,
  Circle,
  X,
  Type,
  Highlighter,
  MessageSquare,
  PenTool,
  Undo2,
  Redo2,
  Trash2,
  Settings2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SignaturePad } from "@/components/adviser/SignaturePad";
import { PdfDocumentPreview } from "@/components/documents/PdfDocumentPreview";

GlobalWorkerOptions.workerSrc = pdfWorker;
type Mark = {
  id: string;
  type: "check" | "cross" | "circle" | "text" | "highlight" | "comment";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
};
type Box = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
type Evaluation = {
  id: string;
  revision: number;
  status: string;
  annotations: Mark[];
  signedAt: string | null;
  signaturePlacement: Box | null;
  lockedAt: string | null;
};
type Detail = {
  evaluation: Evaluation | null;
  template: { id: string; fileName: string };
  editable: boolean;
  signatureRequired: boolean;
  researchTitle: string;
  currentVersion?: boolean;
};
const styleButton =
  "rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-40";
const primary = styleButton + " bg-[var(--color-primary)] text-white";
const clone = (marks: Mark[]) => marks.map((m) => ({ ...m }));

export function PdfEvaluationWorkspace({
  sessionId,
  manuscriptVersionId,
  onShared,
  onDraftSaved,
  readOnly = false,
}: {
  sessionId: string;
  manuscriptVersionId?: string;
  onShared?: () => void;
  onDraftSaved?: () => void;
  readOnly?: boolean;
}) {
  const manuscript = Boolean(manuscriptVersionId);
  const base = manuscript
    ? `/api/defense-sessions/${sessionId}/manuscript-annotations/${manuscriptVersionId}`
    : `/api/defense-sessions/${sessionId}/pdf-evaluation`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 612, height: 792 });
  const [marks, setMarks] = useState<Mark[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Mark["type"] | "select" | "signature">(
    "select",
  );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<Mark[][]>([]),
    [redo, setRedo] = useState<Mark[][]>([]);
  const [text, setText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fitPage, setFitPage] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(760);
  const viewport = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{
      url: string;
      hash: string;
      final?: boolean;
    } | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [signatureBox, setSignatureBox] = useState<Box | null>(null),
    [signatureUrl, setSignatureUrl] = useState("");
  const [signOpen, setSignOpen] = useState(false),
    [signMode, setSignMode] = useState<"saved" | "draw" | "type">("draw");
  const [signatureImage, setSignatureImage] = useState<string | null>(null),
    [saveSignature, setSaveSignature] = useState(false),
    [password, setPassword] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(760);
  const inFlight = useRef(false);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    box: Box;
    resize: boolean;
    before: Mark[];
  } | null>(null);
  const current = useRef({ marks, detail, dirty });
  current.current = { marks, detail, dirty };
  const locked = detail?.evaluation?.status === "LOCKED";
  const editable = Boolean(detail?.editable && !readOnly && !locked && !busy);
  const canShare = manuscript && detail?.editable && !readOnly;

  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    setLoading(true);
    setError("");
    Promise.all([
      apiClient.get<Detail & { review?: Evaluation }>(base),
      apiClient.file(`${base}/source`, { expectedMimeType: "application/pdf" }),
    ])
      .then(async ([data, blob]) => {
        loadingTask = getDocument({ data: await blob.arrayBuffer() });
        loaded = await loadingTask.promise;
        if (!active) {
          await loadingTask.destroy();
          return;
        }
        const normalized = manuscript
          ? {
              ...data,
              evaluation: data.review || null,
              signatureRequired: false,
            }
          : data;
        setDetail(normalized);
        setMarks(normalized.evaluation?.annotations || []);
        setPdf(loaded);
        setDirty(false);
        setSignatureBox(data.evaluation?.signaturePlacement || null);
        if (data.evaluation?.signedAt) {
          const img = await apiClient.file(`${base}/signature`);
          if (active) setSignatureUrl(URL.createObjectURL(img));
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      loadingTask?.destroy();
    };
  }, [base, manuscript]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(Math.max(1, entry.contentRect.width));
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [loading]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !signOpen && !preview) setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [expanded, signOpen, preview]);
  const displayWidth = fitPage
    ? Math.min(
        available,
        (Math.max(1, viewportHeight) * size.width) / size.height,
      )
    : available * zoom;
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let renderTask: any;
    pdf
      .getPage(page)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const natural = p.getViewport({ scale: 1 });
        setSize({ width: natural.width, height: natural.height });
        const viewport = p.getViewport({ scale: displayWidth / natural.width });
        const ratio = window.devicePixelRatio || 1;
        canvas.current.width = Math.floor(viewport.width * ratio);
        canvas.current.height = Math.floor(viewport.height * ratio);
        const context = canvas.current.getContext("2d")!;
        renderTask = p.render({
          canvas: canvas.current,
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        renderTask.promise.catch((e: any) => {
          if (e.name !== "RenderingCancelledException" && !cancelled)
            setError("Unable to render this PDF page.");
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, page, displayWidth]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  useEffect(
    () => () => {
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    },
    [signatureUrl],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const invalidate = () => {
    setDirty(true);
    setPreview(null);
    setConfirmed(false);
    setNotice("");
    if (current.current.detail?.evaluation?.signedAt) {
      setDetail((d) =>
        d
          ? {
              ...d,
              evaluation: d.evaluation
                ? { ...d.evaluation, signedAt: null, signaturePlacement: null }
                : null,
            }
          : d,
      );
      setSignatureUrl("");
      setSignatureBox(null);
      setNotice(
        "Edits removed the earlier signature. Sign the updated draft again.",
      );
    }
  };
  const change = (next: Mark[]) => {
    setUndo((h) => [...h.slice(-39), clone(marks)]);
    setRedo([]);
    setMarks(next);
    invalidate();
  };
  const canDeleteSelected =
    selected === "signature"
      ? Boolean(signatureBox)
      : marks.some((mark) => mark.id === selected);
  const deleteSelected = () => {
    if (!editable || !canDeleteSelected) return;
    drag.current = null;
    setError("");
    if (selected === "signature") {
      if (detail?.evaluation?.signedAt) invalidate();
      setSignatureBox(null);
      setSignatureUrl("");
    } else {
      change(marks.filter((mark) => mark.id !== selected));
    }
    setSelected(null);
  };
  useEffect(() => {
    const onDelete = (event: KeyboardEvent) => {
      if (
        !editable ||
        !canDeleteSelected ||
        preview ||
        signOpen ||
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !["Delete", "Backspace"].includes(event.key)
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
        )
      )
        return;
      event.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", onDelete);
    return () => window.removeEventListener("keydown", onDelete);
  });
  const save = useCallback(async () => {
    if (inFlight.current)
      throw new Error("Please wait for the current save to finish.");
    const state = current.current;
    if (!state.detail) throw new Error("The form is still loading.");
    if (!state.dirty && state.detail.evaluation) return state.detail.evaluation;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await apiClient.put<{
        evaluation: Evaluation;
        review?: Evaluation;
      }>(base, {
        revision: state.detail.evaluation?.revision || 0,
        sourceVersionId: state.detail.template.id,
        annotations: state.marks,
      });
      const result = manuscript ? { evaluation: response.review! } : response;
      setDetail((d) => (d ? { ...d, evaluation: result.evaluation } : d));
      setDirty(false);
      setNotice("Draft saved privately.");
      if (manuscript) onDraftSaved?.();
      return result.evaluation;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [base, manuscript, onDraftSaved]);
  useEffect(() => {
    if (!dirty || busy || !detail?.editable || readOnly) return;
    const timer = setTimeout(
      () => save().catch((e) => setError(e.message)),
      2500,
    );
    return () => clearTimeout(timer);
  }, [marks, dirty, busy, detail?.editable, readOnly, save]);
  const action = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const previewDraft = async () => {
    const item = await save();
    setBusy(true);
    try {
      const result = await apiClient.post<{
        previewHash: string;
        pdfBase64: string;
      }>(`${base}/preview`, { revision: item.revision });
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
        c.charCodeAt(0),
      );
      setPreview({
        url: URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" }),
        ),
        hash: result.previewHash,
      });
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!detail?.evaluation) return;
    const blob = await apiClient.file(
      `/api/defense-sessions/${sessionId}/pdf-evaluations/${detail.evaluation.id}/content?download=1`,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "completed-defense-evaluation.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const point = (e: PointerEvent) => {
    const rect = surface.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };
  const place = (e: PointerEvent) => {
    if (!editable || tool === "select" || drag.current) return;
    if (["text", "comment"].includes(tool) && !text.trim()) {
      setError("Enter the text or comment before placing it on the page.");
      return;
    }
    const p = point(e);
    const width =
      tool === "text"
        ? 0.32
        : tool === "signature"
          ? 0.24
          : tool === "highlight"
            ? 0.25
            : 0.035;
    const height =
      tool === "text" ? 0.055 : tool === "signature" ? 0.07 : 0.025;
    const centered = ["circle", "check", "cross", "comment"].includes(tool);
    const box = {
      page,
      x: Math.max(0, Math.min(1 - width, p.x - (centered ? width / 2 : 0))),
      y: Math.max(0, Math.min(1 - height, p.y - (centered ? height / 2 : 0))),
      width,
      height,
    };
    if (tool === "signature") {
      if (manuscript) return;
      setSignatureBox(box);
      setSelected("signature");
      setTool("select");
      setSignOpen(true);
      return;
    }
    const item: Mark = {
      ...box,
      id: crypto.randomUUID(),
      type: tool,
      ...(["text", "comment"].includes(tool) ? { text: text.trim() } : {}),
    };
    change([...marks, item]);
    setSelected(item.id);
    setTool("select");
  };
  const startDrag = (e: PointerEvent, id: string, box: Box, resize = false) => {
    if (!editable || tool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(id);
    const p = point(e);
    drag.current = {
      id,
      startX: p.x,
      startY: p.y,
      box: { ...box },
      resize,
      before: clone(marks),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e),
      dx = p.x - d.startX,
      dy = p.y - d.startY;
    const box = d.resize
      ? {
          ...d.box,
          width: Math.max(0.012, Math.min(1 - d.box.x, d.box.width + dx)),
          height: Math.max(0.012, Math.min(1 - d.box.y, d.box.height + dy)),
        }
      : {
          ...d.box,
          x: Math.max(0, Math.min(1 - d.box.width, d.box.x + dx)),
          y: Math.max(0, Math.min(1 - d.box.height, d.box.y + dy)),
        };
    if (d.id === "signature") setSignatureBox(box);
    else
      setMarks((items) =>
        items.map((m) => (m.id === d.id ? { ...m, ...box } : m)),
      );
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.id === "signature") {
      if (detail?.evaluation?.signedAt) {
        invalidate();
        setNotice(
          "Signature placement changed. Place and confirm your signature again.",
        );
      }
    } else {
      setUndo((h) => [...h.slice(-39), d.before]);
      setRedo([]);
      invalidate();
    }
  };
  const selectedMark = marks.find((m) => m.id === selected);
  const undoChange = () => {
    const previous = undo.at(-1);
    if (!previous) return;
    setRedo((r) => [...r, clone(marks)]);
    setUndo((h) => h.slice(0, -1));
    setMarks(previous);
    setSelected(null);
    invalidate();
  };
  const redoChange = () => {
    const next = redo.at(-1);
    if (!next) return;
    setUndo((h) => [...h, clone(marks)]);
    setRedo((h) => h.slice(0, -1));
    setMarks(next);
    invalidate();
  };
  const sign = async () => {
    if (!signatureBox) throw new Error("Place a signature box first.");
    const item = await save();
    setBusy(true);
    try {
      const result = await apiClient.post<{ evaluation: Evaluation }>(
        `${base}/sign`,
        {
          revision: item.revision,
          placement: signatureBox,
          password,
          ...(signMode !== "saved"
            ? { signatureImage: signatureImage || "", saveSignature }
            : {}),
        },
      );
      setDetail((d) => (d ? { ...d, evaluation: result.evaluation } : d));
      setPreview(null);
      setSignOpen(false);
      setPassword("");
      const blob = await apiClient.file(`${base}/signature`);
      setSignatureUrl(URL.createObjectURL(blob));
      setNotice(
        "Signature applied. Preview the completed PDF before submitting.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="rounded-2xl border p-8" role="status">
        {manuscript
          ? "Loading your manuscript review…"
          : "Loading your evaluation PDF…"}
      </div>
    );
  if (!detail || !pdf)
    return (
      <div className="rounded-xl border p-6 text-rose-600" role="alert">
        {error ||
          (manuscript
            ? "The manuscript review could not be opened."
            : "The PDF evaluation could not be opened.")}
      </div>
    );
  return (
    <section
      className={
        expanded
          ? "fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
          : "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
      }
    >
      <header className="border-b border-[var(--color-border)] p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">
            {manuscript
              ? "Manuscript review · Private draft"
              : "PDF evaluation · Your personal copy"}
          </p>
          <h2 className="mt-1 text-xl font-bold">{detail.researchTitle}</h2>
          <p className="mt-1 text-base text-[var(--color-text-secondary)]">
            {detail.template.fileName}
          </p>
          <p className="mt-2 text-base text-[var(--color-text-secondary)]">
            {manuscript
              ? `Annotate the published manuscript. Your notes stay private until you share feedback.${readOnly || detail.currentVersion === false ? " This is an earlier manuscript version; its review is read-only." : ""}`
              : locked
                ? "Final submission is locked."
                : "Mark ratings directly on the form. Comments are included on additional pages in the completed PDF."}{" "}
            {!manuscript &&
              (detail.signatureRequired
                ? "Signature required."
                : "Signature optional.")}
          </p>
        </div>
        <span
          className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-bold"
          role="status"
        >
          {busy
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : locked
                ? "Submitted and locked"
                : detail.evaluation
                  ? "Draft saved"
                  : manuscript
                    ? "Blank manuscript review"
                    : "Blank evaluation"}
        </span>
      </header>
      {error && (
        <p
          role="alert"
          className="m-4 rounded-lg bg-rose-500/10 p-3 text-base text-rose-600"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mx-4 mt-3 text-base text-emerald-600">
          {notice}
        </p>
      )}
      <div className={expanded ? "relative min-h-0 flex-1" : "relative"}>
        {panelOpen && (
          <aside
            aria-label="Annotation details"
            className="absolute right-3 top-28 z-20 max-h-[min(65vh,620px)] w-[calc(100%_-_24px)] max-w-[300px] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Annotation details</h3>
              <button
                type="button"
                aria-label="Close annotation details"
                title="Close annotation details"
                onClick={() => setPanelOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-500/10"
              >
                <X size={16} />
              </button>
            </div>
            <fieldset disabled={!editable} className="space-y-3">
              <p className="text-base text-[var(--color-text-secondary)]">
                Choose a tool, then click the PDF. Select a mark to move it;
                drag its corner to resize. Press Delete or Backspace to remove
                the selected mark.
              </p>
              <label className="block text-sm font-bold">
                Text or comment
                <textarea
                  aria-label="Text or comment"
                  rows={3}
                  maxLength={4000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-2 w-full rounded border bg-[var(--color-surface)] p-2 text-base"
                />
              </label>
              {selectedMark && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-base font-bold">
                    Selected {selectedMark.type}
                  </p>
                  {["text", "comment"].includes(selectedMark.type) && (
                    <textarea
                      aria-label="Edit selected annotation"
                      rows={3}
                      value={selectedMark.text || ""}
                      onChange={(e) =>
                        change(
                          marks.map((m) =>
                            m.id === selected
                              ? { ...m, text: e.target.value }
                              : m,
                          ),
                        )
                      }
                      className="w-full rounded border bg-[var(--color-surface)] p-2 text-base"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label key={key} className="text-sm">
                        {key} (%)
                        <input
                          aria-label={`Annotation ${key} percent`}
                          type="number"
                          min={key === "width" || key === "height" ? 1 : 0}
                          max="100"
                          step="0.5"
                          value={Math.round(selectedMark[key] * 1000) / 10}
                          onChange={(e) => {
                            const value = Number(e.target.value) / 100;
                            const updated = { ...selectedMark, [key]: value };
                            if (
                              updated.x >= 0 &&
                              updated.y >= 0 &&
                              updated.width >= 0.005 &&
                              updated.height >= 0.005 &&
                              updated.x + updated.width <= 1 &&
                              updated.y + updated.height <= 1
                            )
                              change(
                                marks.map((m) =>
                                  m.id === selected ? updated : m,
                                ),
                              );
                          }}
                          className="mt-1 w-full rounded border bg-[var(--color-surface)] p-1"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {signatureBox && (
                <button
                  className={`submission-action ${styleButton}`}
                  onClick={() => setSignOpen(true)}
                >
                  {detail.evaluation?.signedAt
                    ? "Confirm signature again"
                    : "Confirm signature placement"}
                </button>
              )}
            </fieldset>
            <div className="border-t pt-3">
              <h3 className="text-lg font-bold">Comments</h3>
              {marks.filter((m) => m.type === "comment").length === 0 && (
                <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                  No comments yet.
                </p>
              )}
              {marks
                .filter((m) => m.type === "comment")
                .sort((a, b) => a.page - b.page)
                .map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setPage(m.page);
                      setSelected(m.id);
                      setTool("select");
                    }}
                    className="mt-2 block w-full rounded border p-2 text-left text-sm"
                  >
                    {i + 1}. Page {m.page}: {m.text}
                  </button>
                ))}
            </div>
          </aside>
        )}
        <div className={expanded ? "flex h-full min-w-0 flex-col" : "min-w-0"}>
          <div className="flex shrink-0 justify-center bg-slate-200/60 px-2 pt-3 pb-2">
            <div
              role="toolbar"
              aria-label="Annotation tools"
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-slate-800 p-1.5 text-slate-200 shadow-lg"
            >
              {(
                [
                  ["select", "Select / move", MousePointer2],
                  ["check", "Checkmark", Check],
                  ["circle", "Circle", Circle],
                  ["cross", "Cross", X],
                  ["text", "Text", Type],
                  ["highlight", "Highlight", Highlighter],
                  ["comment", "Comment", MessageSquare],
                  ["signature", "Signature", PenTool],
                ] as const
              )
                .filter(([id]) => !manuscript || id !== "signature")
                .map(([id, label, Icon]) => (
                  <button
                    type="button"
                    key={id}
                    aria-label={label}
                    title={label}
                    aria-pressed={tool === id}
                    disabled={!editable}
                    onClick={() => {
                      setTool(id);
                      setSelected(null);
                      setError("");
                      if (id === "text" || id === "comment") setPanelOpen(true);
                    }}
                    className={`shrink-0 rounded-xl p-2.5 transition-colors disabled:opacity-35 ${tool === id ? "bg-sky-500 text-white" : "hover:bg-white/10"}`}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </button>
                ))}
              <span className="mx-1 h-6 shrink-0 border-l border-white/20" />
              {(
                [
                  ["Undo", Undo2, undoChange, !editable || !undo.length],
                  ["Redo", Redo2, redoChange, !editable || !redo.length],
                  [
                    "Delete selected",
                    Trash2,
                    deleteSelected,
                    !canDeleteSelected,
                  ],
                ] as const
              ).map(([label, Icon, action, disabled]) => (
                <button
                  type="button"
                  key={label}
                  aria-label={label}
                  title={
                    label === "Delete selected"
                      ? "Delete selected (Delete / Backspace)"
                      : label
                  }
                  aria-keyshortcuts={
                    label === "Delete selected" ? "Delete Backspace" : undefined
                  }
                  disabled={disabled}
                  onClick={action}
                  className="shrink-0 rounded-xl p-2.5 hover:bg-white/10 disabled:opacity-35"
                >
                  <Icon size={18} aria-hidden="true" />
                </button>
              ))}
              <span className="mx-1 h-6 shrink-0 border-l border-white/20" />
              <button
                type="button"
                aria-label="Annotation details and comments"
                title="Annotation details and comments"
                aria-expanded={panelOpen}
                onClick={() => setPanelOpen(!panelOpen)}
                className={`shrink-0 rounded-xl p-2.5 ${panelOpen ? "bg-white/20" : "hover:bg-white/10"}`}
              >
                <Settings2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={expanded ? "Exit expanded view" : "Expand PDF view"}
                title={
                  expanded ? "Exit expanded view (Esc)" : "Expand PDF view"
                }
                onClick={() => setExpanded(!expanded)}
                className="shrink-0 rounded-xl p-2.5 hover:bg-white/10"
              >
                {expanded ? (
                  <Minimize2 size={18} aria-hidden="true" />
                ) : (
                  <Maximize2 size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <nav
            aria-label="PDF page controls"
            className="flex shrink-0 flex-wrap items-center justify-center gap-3 bg-slate-200/60 px-3 pb-3"
          >
            <button
              className={styleButton}
              aria-label="Previous page"
              title="Previous page"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setSelected(null);
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-sm">
              Page {page} of {pdf.numPages}
            </span>
            <button
              className={styleButton}
              aria-label="Next page"
              title="Next page"
              disabled={page >= pdf.numPages}
              onClick={() => {
                setPage((p) => p + 1);
                setSelected(null);
              }}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <label className="text-sm">
              Zoom{" "}
              <select
                aria-label="PDF zoom"
                value={fitPage ? "page" : zoom}
                onChange={(e) => {
                  setFitPage(e.target.value === "page");
                  if (e.target.value !== "page")
                    setZoom(Number(e.target.value));
                }}
                className="rounded border bg-[var(--color-surface)] p-2"
              >
                <option value="page">Fit page</option>
                {[0.75, 1, 1.25, 1.5, 2].map((v) => (
                  <option key={v} value={v}>
                    {v === 1 ? "Fit width" : `${v * 100}%`}
                  </option>
                ))}
              </select>
            </label>
          </nav>
          <div
            ref={viewport}
            className={`overflow-auto bg-slate-200/60 p-4 ${expanded ? "min-h-0 flex-1" : "h-[min(78vh,850px)] min-h-[280px]"}`}
          >
            <div
              ref={surface}
              data-testid="evaluation-pdf-page"
              onPointerDown={place}
              onPointerMove={move}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="relative mx-auto bg-white shadow-lg touch-none"
              style={{
                width: displayWidth,
                height: (displayWidth * size.height) / size.width,
                cursor: tool === "select" ? "default" : "crosshair",
              }}
            >
              <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
              <svg
                aria-label={`Annotation layer for page ${page}`}
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${size.width} ${size.height}`}
              >
                {marks
                  .filter((m) => m.page === page)
                  .map((m) => {
                    const x = m.x * size.width,
                      y = m.y * size.height,
                      w = m.width * size.width,
                      h = m.height * size.height;
                    return (
                      <g
                        key={m.id}
                        data-mark-id={m.id}
                        onPointerDown={(e) => startDrag(e, m.id, m)}
                        style={{
                          cursor:
                            editable && tool === "select" ? "move" : undefined,
                        }}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          fill="transparent"
                        />
                        {m.type === "circle" && (
                          <ellipse
                            cx={x + w / 2}
                            cy={y + h / 2}
                            rx={w / 2}
                            ry={h / 2}
                            fill="none"
                            stroke="#143866"
                            strokeWidth="1.4"
                          />
                        )}
                        {m.type === "highlight" && (
                          <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            fill="#ffd919"
                            opacity=".3"
                          />
                        )}
                        {m.type === "check" && (
                          <path
                            d={`M${x} ${y + h * 0.5} L${x + w * 0.35} ${y + h} L${x + w} ${y}`}
                            fill="none"
                            stroke="#143866"
                            strokeWidth="1.6"
                          />
                        )}
                        {m.type === "cross" && (
                          <path
                            d={`M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}`}
                            stroke="#143866"
                            strokeWidth="1.6"
                          />
                        )}
                        {m.type === "text" &&
                          (m.text || "").split("\n").map((line, i) => (
                            <text
                              key={i}
                              x={x}
                              y={y + 10 + i * 12}
                              fontFamily="Helvetica,Arial,sans-serif"
                              fontSize="10"
                              fill="#143866"
                            >
                              {line}
                            </text>
                          ))}
                        {m.type === "comment" && (
                          <>
                            <rect
                              x={x}
                              y={y}
                              width={w}
                              height={h}
                              fill="#fff0a5"
                              stroke="#143866"
                              strokeWidth=".5"
                            />
                            <text
                              x={x + 2}
                              y={y + h / 2 + 4}
                              fontSize={Math.min(10, h - 2)}
                              fill="#143866"
                            >
                              {
                                marks.filter(
                                  (a) =>
                                    a.type === "comment" &&
                                    (a.page < m.page ||
                                      (a.page === m.page &&
                                        marks.indexOf(a) <= marks.indexOf(m))),
                                ).length
                              }
                            </text>
                          </>
                        )}
                        {selected === m.id && editable && (
                          <>
                            <rect
                              x={x - 1}
                              y={y - 1}
                              width={w + 2}
                              height={h + 2}
                              fill="none"
                              stroke="#2671e8"
                              strokeDasharray="3 2"
                            />
                            <rect
                              onPointerDown={(e) => startDrag(e, m.id, m, true)}
                              x={x + w - 4}
                              y={y + h - 4}
                              width="8"
                              height="8"
                              fill="#2671e8"
                              style={{ cursor: "nwse-resize" }}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                {signatureBox?.page === page && (
                  <g
                    onPointerDown={(e) =>
                      startDrag(e, "signature", signatureBox)
                    }
                  >
                    {signatureUrl ? (
                      <image
                        href={signatureUrl}
                        x={signatureBox.x * size.width}
                        y={signatureBox.y * size.height}
                        width={signatureBox.width * size.width}
                        height={signatureBox.height * size.height}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    ) : (
                      <rect
                        x={signatureBox.x * size.width}
                        y={signatureBox.y * size.height}
                        width={signatureBox.width * size.width}
                        height={signatureBox.height * size.height}
                        fill="#e1efff"
                        stroke="#2671e8"
                        strokeDasharray="3 2"
                      />
                    )}
                    {selected === "signature" && editable && (
                      <rect
                        onPointerDown={(e) =>
                          startDrag(e, "signature", signatureBox, true)
                        }
                        x={
                          (signatureBox.x + signatureBox.width) * size.width - 4
                        }
                        y={
                          (signatureBox.y + signatureBox.height) * size.height -
                          4
                        }
                        width="8"
                        height="8"
                        fill="#2671e8"
                      />
                    )}
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4">
        <p className="text-base text-[var(--color-text-secondary)]">
          {manuscript
            ? "Drafts are private. Sharing publishes a fixed copy to the professor and active research group members."
            : locked
              ? "Your final PDF is available for download."
              : "Your draft is private. The professor sees it only after final submission."}
        </p>
        <div className="flex gap-2">
          {locked ? (
            <>
              <button
                className={styleButton}
                onClick={() =>
                  action(async () => {
                    const blob = await apiClient.file(
                      `/api/defense-sessions/${sessionId}/pdf-evaluations/${detail.evaluation!.id}/content`,
                    );
                    setPreview({
                      url: URL.createObjectURL(blob),
                      hash: "",
                      final: true,
                    });
                  })
                }
              >
                Preview final PDF
              </button>
              <button className={primary} onClick={() => action(download)}>
                Download final PDF
              </button>
            </>
          ) : (
            <>
              <button
                disabled={!editable}
                className={styleButton}
                onClick={() =>
                  action(async () => {
                    await save();
                  })
                }
              >
                Save draft
              </button>
              <button
                disabled={
                  busy ||
                  (!editable && !(manuscript && detail.evaluation)) ||
                  !marks.length
                }
                className={primary}
                onClick={() => action(previewDraft)}
              >
                {manuscript
                  ? "Preview annotated manuscript"
                  : "Preview completed PDF"}
              </button>
            </>
          )}
        </div>
      </footer>
      {signOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sign evaluation"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-[var(--color-surface)] p-6 space-y-4">
            <h3 className="text-lg font-bold">Sign your evaluation</h3>
            <p className="text-base">
              Your signature will be placed in the selected box on page{" "}
              {signatureBox?.page}. Editing the draft afterward removes it.
            </p>
            <label className="block text-sm">
              Signature source
              <select
                aria-label="Signature source"
                value={signMode}
                onChange={(e) => {
                  setSignMode(e.target.value as typeof signMode);
                  setSignatureImage(null);
                }}
                className="mt-2 w-full rounded border bg-[var(--color-surface)] p-2"
              >
                <option value="saved">My saved signature</option>
                <option value="draw">Signature pad (draw)</option>
                <option value="type">Type a signature</option>
              </select>
            </label>
            {signMode !== "saved" && (
              <>
                <SignaturePad
                  key={signMode}
                  mode={signMode}
                  onChange={setSignatureImage}
                  disabled={busy}
                />
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveSignature}
                    onChange={(e) => setSaveSignature(e.target.checked)}
                  />
                  Save this signature to my private profile
                </label>
              </>
            )}
            <label className="block text-sm">
              Confirm your password
              <input
                aria-label="Confirm your password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded border bg-[var(--color-surface)] p-2"
              />
            </label>
            {error && (
              <p role="alert" className="text-base text-rose-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                disabled={busy}
                className={styleButton}
                onClick={() => {
                  setSignOpen(false);
                  setPassword("");
                }}
              >
                Cancel
              </button>
              <button
                disabled={
                  busy || !password || (signMode !== "saved" && !signatureImage)
                }
                className={primary}
                onClick={() => action(sign)}
              >
                Apply signature
              </button>
            </div>
          </div>
        </div>
      )}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            manuscript
              ? "Preview manuscript feedback"
              : "Preview completed evaluation"
          }
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3"
        >
          <div className="flex h-[94vh] w-full max-w-6xl flex-col rounded-xl bg-[var(--color-surface)] p-4 gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">
                {manuscript
                  ? "Review feedback before sharing"
                  : preview.final
                    ? "Final submitted evaluation"
                    : "Review your completed evaluation"}
              </h3>
              <button
                disabled={busy}
                className={styleButton}
                onClick={() => setPreview(null)}
              >
                {preview.final ? "Close preview" : "Back to editing"}
              </button>
            </div>
            <PdfDocumentPreview url={preview.url} />
            {!preview.final && (!manuscript || canShare) && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {manuscript
                  ? "I reviewed this copy and want to share all its annotations with the professor and active research group members."
                  : "I reviewed all pages and confirm this evaluation is ready for final submission."}
              </label>
            )}
            {!preview.final &&
              detail.signatureRequired &&
              !detail.evaluation?.signedAt && (
                <p className="text-base text-amber-600">
                  Return to editing and sign this evaluation before submitting.
                </p>
              )}
            {error && (
              <p role="alert" className="text-base text-rose-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <a
                download={
                  manuscript
                    ? "annotated-manuscript.pdf"
                    : preview.final
                      ? "completed-evaluation.pdf"
                      : "draft-evaluation.pdf"
                }
                href={preview.url}
                className={styleButton}
              >
                Download PDF
              </a>
              {!preview.final && (!manuscript || canShare) && (
                <button
                  disabled={
                    busy ||
                    !confirmed ||
                    (detail.signatureRequired && !detail.evaluation?.signedAt)
                  }
                  className={`submission-action ${primary}`}
                  onClick={() =>
                    action(async () => {
                      setBusy(true);
                      try {
                        const response = await apiClient.post<{
                          evaluation: Evaluation;
                          review?: Evaluation;
                        }>(`${base}/${manuscript ? "share" : "submit"}`, {
                          revision: detail.evaluation!.revision,
                          previewHash: preview.hash,
                          confirmed: true,
                        });
                        const result = manuscript
                          ? { evaluation: response.review! }
                          : response;
                        setDetail((d) =>
                          d
                            ? {
                                ...d,
                                evaluation: result.evaluation,
                                editable: manuscript ? d.editable : false,
                              }
                            : d,
                        );
                        setPreview(null);
                        setNotice(
                          manuscript
                            ? "Feedback shared. Further edits remain private until you share again."
                            : "Evaluation submitted and permanently locked.",
                        );
                        if (manuscript) onShared?.();
                      } finally {
                        setBusy(false);
                      }
                    })
                  }
                >
                  {manuscript ? "Share feedback" : "Submit final & lock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
