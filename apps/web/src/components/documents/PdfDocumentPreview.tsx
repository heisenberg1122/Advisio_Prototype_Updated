import { useEffect, useRef, useState } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = pdfWorker;

// Render within Advisio so previews work even in browsers without a PDF plugin.
export function PdfDocumentPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof getDocument> | null = null;
    setPdf(null);
    setPage(1);
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
        const viewport = p.getViewport({ scale: width / natural.width });
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
  }, [pdf, page, width]);
  return (
    <div
      ref={host}
      className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)]"
    >
      <div className="flex flex-wrap items-center justify-center gap-3 bg-[var(--color-surface)] p-2 text-sm">
        <button
          disabled={!pdf || page <= 1}
          className="rounded border px-3 py-2 disabled:opacity-40"
          onClick={() => setPage((p) => p - 1)}
        >
          Previous preview page
        </button>
        <span role="status">
          {pdf ? `Preview page ${page} of ${pdf.numPages}` : "Loading preview…"}
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
      {error && (
        <p role="alert" className="p-4 text-rose-600">
          {error}
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
