import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Minus,
  Plus,
} from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = pdfWorker;

// Render within Advisio so previews work even in browsers without a PDF plugin.
export function PdfDocumentPreview({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [expanded, setExpanded] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof getDocument> | null = null;
    setPdf(null);
    setPage(1);
    setZoom(1);
    setError("");
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => {
        if (!active) return;
        task = getDocument({ data });
        return task.promise;
      })
      .then((doc) => {
        if (active && doc) setPdf(doc);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(240, Math.min(850, entries[0].contentRect.width - 32))),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let task: any;
    setRendering(true);
    pdf
      .getPage(page)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const natural = p.getViewport({ scale: 1 });
        const viewport = p.getViewport({
          scale: (width / natural.width) * zoom,
        });
        const ratio = window.devicePixelRatio || 1;
        canvas.current.width = viewport.width * ratio;
        canvas.current.height = viewport.height * ratio;
        canvas.current.style.width = `${viewport.width}px`;
        canvas.current.style.height = `${viewport.height}px`;
        task = p.render({
          canvas: canvas.current,
          canvasContext: canvas.current.getContext("2d")!,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        return task.promise;
      })
      .then(() => !cancelled && setRendering(false))
      .catch((e) => {
        if (!cancelled && e.name !== "RenderingCancelledException") {
          setError("Unable to render this preview.");
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, width, zoom]);
  useEffect(() => setPageInput(String(page)), [page]);
  useEffect(() => {
    const updateFullscreen = () =>
      setExpanded(document.fullscreenElement === host.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);
  const jumpToPage = () => {
    const requestedPage = Number(pageInput);
    if (
      pdf &&
      Number.isInteger(requestedPage) &&
      requestedPage >= 1 &&
      requestedPage <= pdf.numPages
    )
      setPage(requestedPage);
    else setPageInput(String(page));
  };
  const toggleFullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement === host.current)
        await document.exitFullscreen();
      else await host.current?.requestFullscreen();
    } catch {
      setFullscreenError("Your browser could not expand this preview.");
    }
  };
  const toolbarButton =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-[var(--color-text-primary)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div
      ref={host}
      className={`min-h-0 flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)] ${compact ? "" : "rounded-lg border border-[var(--color-border)]"} ${expanded ? "h-screen w-screen" : ""}`}
    >
      {compact ? (
        <div
          role="toolbar"
          aria-label="PDF preview controls"
          className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous preview page"
              title="Previous page"
              disabled={!pdf || page <= 1}
              className={toolbarButton}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              aria-label="Preview page number"
              type="text"
              inputMode="numeric"
              value={pageInput}
              disabled={!pdf}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={jumpToPage}
              onKeyDown={(event) => {
                if (event.key === "Enter") jumpToPage();
              }}
              className="h-6 w-8 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
            />
            <span
              aria-hidden="true"
              className="px-1 text-[var(--color-text-secondary)]"
            >
              / {pdf?.numPages || "—"}
            </span>
            <button
              type="button"
              aria-label="Next preview page"
              title="Next page"
              disabled={!pdf || page >= pdf.numPages}
              className={toolbarButton}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span role="status" className="sr-only">
              {pdf
                ? `Preview page ${page} of ${pdf.numPages}`
                : "Loading preview…"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              disabled={!pdf || zoom <= 0.5}
              className={toolbarButton}
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Reset preview zoom to fit width"
              title="Reset zoom to fit width"
              disabled={!pdf}
              className="min-w-12 rounded px-1 py-1 font-semibold text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
              onClick={() => setZoom(1)}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              disabled={!pdf || zoom >= 2}
              className={toolbarButton}
              onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {document.fullscreenEnabled && (
              <button
                type="button"
                aria-label={
                  expanded ? "Exit expanded preview" : "Expand preview"
                }
                title={expanded ? "Exit expanded preview" : "Expand preview"}
                className={`${toolbarButton} ml-1`}
                onClick={() => void toggleFullscreen()}
              >
                {expanded ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-[var(--color-surface)] p-2 text-sm">
          <button
            disabled={!pdf || page <= 1}
            className="rounded border px-3 py-2 disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            Previous preview page
          </button>
          <span role="status">
            {pdf
              ? `Preview page ${page} of ${pdf.numPages}`
              : "Loading preview…"}
          </span>
          <button
            disabled={!pdf || page >= pdf.numPages}
            className="rounded border px-3 py-2 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next preview page
          </button>
          {rendering && pdf && <span className="text-xs">Rendering…</span>}
        </div>
      )}
      {(error || fullscreenError) && (
        <p role="alert" className="p-4 text-rose-600">
          {error || fullscreenError}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4">
        <canvas
          ref={canvas}
          aria-label={`Completed PDF page ${page}`}
          className="mx-auto bg-white shadow"
        />
      </div>
    </div>
  );
}
