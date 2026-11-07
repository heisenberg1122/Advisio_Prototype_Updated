import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GuidedStep } from "@/lib/workspace-tours";
import "./product-tour.css";

type Rect = { top: number; left: number; width: number; height: number; bottom: number; right: number };
type ProductTourProps = {
  step: GuidedStep; index: number; total: number; routeReady: boolean;
  onBack: () => void; onNext: (completedStep: boolean) => void; onClose: () => void; onRetry: () => void;
};

export function ProductTour({ step, index, total, routeReady, onBack, onNext, onClose, onRetry }: ProductTourProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [tooltipHeight, setTooltipHeight] = useState(250);
  const dialog = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    setRect(null); setMissing(false); target.current = null;
    let frame = 0;
    let scrolled = false;
    const started = performance.now();
    const update = () => {
      const element = routeReady ? Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)).find(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden") : undefined;
      if (!element) {
        setRect(previous => previous ? null : previous);
        if (performance.now() - started > 8000) setMissing(true);
        return;
      }
      target.current = element;
      if (!scrolled) {
        scrolled = true;
        if (step.target === "workspace-content") window.scrollTo({ top: 0, behavior: "instant" });
        else element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      }
      const raw = element.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      if (raw.bottom < 0 || raw.top > height || raw.right < 0 || raw.left > width) { setRect(null); setMissing(true); return; }
      const top = Math.max(8, Math.min(raw.top - 5, height - 60));
      const left = Math.max(8, raw.left - 5);
      const right = Math.min(width - 8, raw.right + 5);
      const bottom = Math.min(height - 8, raw.bottom + 5, top + (step.target === "workspace-content" ? 180 : 260));
      const measured = { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top), bottom, right };
      if (measured.width < 1 || measured.height < 1) { setRect(null); return; }
      setMissing(false);
      setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
      setRect(previous => previous && Object.keys(measured).every(key => previous[key as keyof Rect] === measured[key as keyof Rect]) ? previous : measured);
    };
    const poll = () => { update(); frame = requestAnimationFrame(poll); };
    frame = requestAnimationFrame(poll);
    return () => { cancelAnimationFrame(frame); };
  }, [step.target, step.href, routeReady, retry]);

  useLayoutEffect(() => {
    if (!dialog.current) return;
    const measure = () => setTooltipHeight(dialog.current?.offsetHeight || 250);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dialog.current);
    return () => observer.disconnect();
  }, []);

  const ready = Boolean(rect) || missing;
  useEffect(() => { if (ready) next.current?.focus({ preventScroll: true }); }, [index, ready]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const tooltipItems = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]") || []);
      const targetItems = step.interactive && rect ? [target.current, ...Array.from(target.current?.querySelectorAll<HTMLElement>("input:not([type=file]),select,button,a[href]") || [])]
        .filter((el): el is HTMLElement => Boolean(el && el.matches("input,select,button,a[href]") && el.getClientRects().length && !el.hasAttribute("disabled"))) : [];
      const items = [...targetItems, ...tooltipItems];
      if (!items.length) return;
      const position = items.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      items[(position + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [onClose, step.interactive, rect]);

  const width = Math.min(340, viewport.width - 24);
  const left = rect ? Math.max(12, Math.min(rect.left, viewport.width - width - 12)) : Math.max(12, (viewport.width - width) / 2);
  const below = rect && viewport.height - rect.bottom >= tooltipHeight + 20;
  const top = rect ? below ? rect.bottom + 10 : rect.top >= tooltipHeight + 20 ? rect.top - tooltipHeight - 10 : Math.max(12, viewport.height - tooltipHeight - 12) : Math.max(12, (viewport.height - tooltipHeight) / 2);
  const retryTarget = () => { onRetry(); setRetry(value => value + 1); };

  return createPortal(<div className="product-tour" data-tour-active="true">
    {rect && <>
      <div className="product-tour__shade" style={{ left: 0, top: 0, width: "100%", height: rect.top }} />
      <div className="product-tour__shade" style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
      <div className="product-tour__shade" style={{ left: rect.right, top: rect.top, right: 0, height: rect.height }} />
      <div className="product-tour__shade" style={{ left: 0, top: rect.bottom, width: "100%", bottom: 0 }} />
      <div className="product-tour__spotlight" data-tour-spotlight={step.target} style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, pointerEvents: step.interactive ? "none" : "auto" }} />
    </>}
    <div ref={dialog} role="dialog" aria-modal={step.interactive ? undefined : true} aria-labelledby="product-tour-title" aria-describedby="product-tour-content" className="product-tour__tooltip" style={{ left, top, width, maxHeight: viewport.height - 24 }}>
      <div className="product-tour__heading"><span role="status" aria-live="polite">Step {index + 1} of {total}</span><button type="button" aria-label="Close tour" onClick={onClose}><X size={18} /></button></div>
      <h2 id="product-tour-title">{step.title}</h2>
      <p id="product-tour-content">{missing ? step.fallback || "This area is unavailable. Retry or skip this step to continue safely." : !rect ? "Finding this part of your workspace…" : step.content}</p>
      {step.interactive && rect && <p className="product-tour__hint">You can try the highlighted controls.</p>}
      <div className="product-tour__actions">
        <button type="button" onClick={onClose}>Skip tour</button>
        {index > 0 && <button type="button" onClick={onBack}>Back</button>}
        {missing && <button type="button" onClick={retryTarget}>Retry</button>}
        <button ref={next} type="button" className="product-tour__primary" disabled={!rect && !missing} onClick={() => onNext(!missing)}>{missing ? "Skip step" : index === total - 1 ? "Finish" : "Next"}</button>
      </div>
    </div>
  </div>, document.body);
}
