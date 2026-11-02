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
  TextLayer,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useSubmissionHighlights } from "./SubmissionHighlightContext";
import {
  captureTextAnchor,
  type SubmissionTextAnchor,
} from "@/lib/submission-highlight";
import "./pdf-text-selection.css";
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
  const discussion = useSubmissionHighlights();
  const withTextLayer = Boolean(discussion);
  const [selection, setSelection] = useState<SubmissionTextAnchor | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const pageHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState({ width: 300, height: 150 });
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const renderKey = `${url}:${page}:${width}:${zoom}`;
  const [renderedKey, setRenderedKey] = useState("");
  const isRendering = rendering || renderedKey !== renderKey;
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
    let textLayer: TextLayer | null = null;
    setSelection(null);
    setTextMessage("");
    textHost.current?.replaceChildren();
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
        setPageSize({ width: viewport.width, height: viewport.height });
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
        const renderText = async () => {
          if (!withTextLayer || !textHost.current) return;
          try {
            const content = await p.getTextContent();
            if (cancelled || !textHost.current) return;
            textHost.current.style.setProperty(
              "--total-scale-factor",
              String(viewport.scale * viewport.userUnit),
            );
            textLayer = new TextLayer({
              textContentSource: content,
              container: textHost.current,
              viewport,
            });
            await textLayer.render();
            if (
              !cancelled &&
              !textLayer.textContentItemsStr.some((text) => text.trim())
            )
              setTextMessage(
                "This page has no selectable text. You can still post a page comment.",
              );
          } catch {
            if (!cancelled)
              setTextMessage(
                "Text selection is unavailable on this page. You can still post a page comment.",
              );
          }
        };
        return Promise.all([task.promise, renderText()]);
      })
      .then(() => {
        if (!cancelled) {
          setRendering(false);
          setRenderedKey(renderKey);
        }
      })
      .catch((e) => {
        if (!cancelled && e.name !== "RenderingCancelledException") {
          setError("Unable to render this preview.");
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, width, zoom, withTextLayer]);
  useEffect(() => {
    if (!discussion?.canComment || isRendering) return;
    const capture = () => {
      if (!textHost.current || !pageHost.current) return;
      const nativeSelection = window.getSelection();
      const anchor = captureTextAnchor(
        nativeSelection,
        textHost.current,
        page,
        pageHost.current,
      );
      if (anchor) {
        setSelection(anchor);
        setTextMessage("");
      } else if (nativeSelection && !nativeSelection.isCollapsed)
        setSelection(null);
    };
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, [discussion?.canComment, isRendering, page]);
  const focused = discussion?.focused;
  useEffect(() => {
    if (focused) setPage(focused.textAnchor.pageNumber);
  }, [focused]);
  useEffect(() => {
    if (
      !focused ||
      isRendering ||
      focused.textAnchor.pageNumber !== page ||
      !pageHost.current
    )
      return;
    const first = focused.textAnchor.rects[0];
    const container = pageHost.current.parentElement!;
    container.scrollTo({
      top:
        pageHost.current.offsetTop -
        container.offsetTop +
        first.y * pageSize.height -
        60,
      left: Math.max(0, first.x * pageSize.width - 40),
      behavior: "smooth",
    });
  }, [focused, isRendering, page, pageSize]);
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
      {discussion && (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
          role="status"
        >
          <span>
            {textMessage ||
              (discussion.canComment
                ? "Select text on the page to attach a comment."
                : "Select a quoted comment to locate its highlight.")}
          </span>
          {discussion.canComment && (
            <button
              type="button"
              disabled={!selection}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const nativeSelection = window.getSelection();
                const hasNativeSelection =
                  nativeSelection && !nativeSelection.isCollapsed;
                const anchor =
                  hasNativeSelection && textHost.current && pageHost.current
                    ? captureTextAnchor(
                        nativeSelection,
                        textHost.current,
                        page,
                        pageHost.current,
                      )
                    : selection;
                if (anchor) {
                  discussion.compose(anchor);
                  setSelection(null);
                  window.getSelection()?.removeAllRanges();
                } else {
                  setSelection(null);
                  setTextMessage(
                    "Select a shorter passage within this page, up to 5,000 characters.",
                  );
                }
              }}
              className={`rounded-lg bg-[var(--color-primary)] px-3 py-2 font-bold text-[var(--college-on-primary)] ${selection ? "" : "invisible"}`}
            >
              Comment on selection
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4">
        <div
          ref={pageHost}
          className="advisio-pdf-page shadow"
          data-page-number={page}
          data-rendering={isRendering}
          aria-busy={isRendering}
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          <canvas
            ref={canvas}
            aria-label={`Completed PDF page ${page}`}
            className="block bg-white"
          />
          {discussion && (
            <>
              <div className="advisio-pdf-highlights" aria-hidden="true">
                {[
                  ...discussion.highlights.map((item) => ({
                    ...item,
                    draft: false,
                  })),
                  ...(discussion.draft
                    ? [
                        {
                          id: "draft",
                          textAnchor: discussion.draft,
                          draft: true,
                        },
                      ]
                    : []),
                ]
                  .filter((item) => item.textAnchor.pageNumber === page)
                  .flatMap((item) =>
                    item.textAnchor.rects.map((rect, index) => (
                      <span
                        key={`${item.id}:${index}`}
                        data-highlight-id={item.id}
                        className={`advisio-pdf-highlight ${focused?.id === item.id || item.draft ? "is-focused" : ""}`}
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.width * 100}%`,
                          height: `${rect.height * 100}%`,
                        }}
                      />
                    )),
                  )}
              </div>
              <div ref={textHost} className="advisio-pdf-text" />
              {discussion.highlights
                .filter((item) => item.textAnchor.pageNumber === page)
                .map((item, index) => {
                  const rect = item.textAnchor.rects[0];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="advisio-pdf-comment-marker"
                      aria-label={`Show comment on: ${item.textAnchor.selectedText.slice(0, 100)}`}
                      title="Show attached comment"
                      style={{
                        left: `${Math.min(0.96, rect.x + rect.width) * 100}%`,
                        top: `${rect.y * 100}%`,
                      }}
                      onClick={() => discussion.focusHighlight(item)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
