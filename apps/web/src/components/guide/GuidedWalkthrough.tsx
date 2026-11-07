import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { connectedGuideGeometry, type GuideRect } from "./guide-geometry";
import type {
  GuidedControlStep,
  GuidedTarget,
} from "./guided-walkthrough-types";
import "./researcher-guide.css";

export function findGuideTarget(key: string): HTMLElement | null {
  const elements = key.startsWith("id:")
    ? [document.getElementById(key.slice(3))]
    : Array.from(
        document.querySelectorAll<HTMLElement>(`[data-guide="${key}"]`),
      );
  return (
    elements.find((element): element is HTMLElement =>
      Boolean(
        element?.getClientRects().length &&
        (element.checkVisibility?.({
          // Styled native selects can be transparent over a visible label.
          opacityProperty: element.dataset.guideTransparent !== "true",
          visibilityProperty: true,
        }) ??
          getComputedStyle(element).visibility !== "hidden"),
      ),
    ) || null
  );
}
interface Props {
  step: GuidedControlStep;
  index: number;
  total?: number;
  canGoBack: boolean;
  isLast: boolean;
  onIntent: () => void;
  onNext: (
    target: GuidedTarget | null,
    skipped?: boolean,
    interacted?: boolean,
  ) => void;
  onBack: () => void;
  onExit: () => void;
  onRetry: () => void;
  onExplore: () => void;
}
export function GuidedWalkthrough({
  step,
  index,
  total,
  canGoBack,
  isLast,
  onIntent,
  onNext,
  onBack,
  onExit,
  onRetry,
  onExplore,
}: Props) {
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [variant, setVariant] = useState<GuidedTarget | null>(null);
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [text, setText] = useState(step.text);
  const [viewport, setViewport] = useState({
    width: innerWidth,
    height: innerHeight,
  });
  const [tooltipHeight, setTooltipHeight] = useState(240);
  const element = useRef<HTMLElement | null>(null),
    tooltip = useRef<HTMLDivElement>(null),
    primary = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const marker = "guide-arrow-" + useId().replace(/[^a-z0-9]/gi, "");
  const clickIntent = useEffectEvent(() => onIntent());
  const interacted = useEffectEvent((target: GuidedTarget) =>
    onNext(target, false, true),
  );

  useEffect(() => {
    let frame = 0,
      actionFrame = 0,
      scrolled: HTMLElement | null = null;
    const started = performance.now();
    element.current = null;
    setRect(null);
    setVariant(null);
    setMissing(false);
    const update = () => {
      const found = step.targets
        .map((target) => ({ target, node: findGuideTarget(target.key) }))
        .find((item) => item.node);
      if (!found) {
        setRect((previous) => (previous ? null : previous));
        if (performance.now() - started > 7000) setMissing(true);
      } else {
        element.current = found.node;
        if (scrolled !== found.node) {
          scrolled = found.node;
          found.node!.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "instant",
          });
        }
        const bounds = found.node!.getBoundingClientRect(),
          width = innerWidth,
          height = innerHeight;
        if (
          bounds.bottom <= 0 ||
          bounds.top >= height ||
          bounds.right <= 0 ||
          bounds.left >= width
        ) {
          setRect(null);
          setMissing(performance.now() - started > 7000);
        } else {
          const left = Math.max(4, bounds.left - 4),
            top = Math.max(4, bounds.top - 4),
            right = Math.min(width - 4, bounds.right + 4),
            bottom = Math.min(height - 4, bounds.bottom + 4);
          const next = {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
          };
          setRect((previous) =>
            previous &&
            Object.keys(next).every(
              (key) =>
                previous[key as keyof GuideRect] ===
                next[key as keyof GuideRect],
            )
              ? previous
              : next,
          );
          setViewport((previous) =>
            previous.width === width && previous.height === height
              ? previous
              : { width, height },
          );
          setVariant(found.target);
          const description =
            found.node!.dataset.guideEmpty === "true" && found.target.emptyText
              ? found.target.emptyText
              : found.target.text || step.text;
          setText(
            description.replace(
              "{name}",
              found.node!.dataset.guideName || "this document",
            ),
          );
          setMissing(false);
        }
      }
      frame = requestAnimationFrame(update);
    };
    const capture = (event: Event) => {
      const clicked =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-guide]")
          : null;
      const chosen = step.targets.find(
        (target) => target.anyMatching && target.key === clicked?.dataset.guide,
      );
      const targetElement = chosen ? clicked : element.current;
      const current =
        chosen ||
        step.targets.find(
          (target) =>
            target.key === targetElement?.dataset.guide ||
            target.key === "id:" + targetElement?.id,
        );
      if (
        !targetElement?.contains(event.target as Node) ||
        targetElement.hasAttribute("disabled")
      )
        return;
      if (
        event.type === "change" &&
        current?.interaction === "input" &&
        targetElement instanceof HTMLSelectElement
      ) {
        clickIntent();
        return;
      }
      if (
        event instanceof KeyboardEvent &&
        (!targetElement.matches('[role="button"]:not(button)') ||
          !["Enter", " "].includes(event.key))
      )
        return;
      if (actionFrame || current?.interaction !== "click") return;
      clickIntent();
      actionFrame = requestAnimationFrame(() => {
        actionFrame = 0;
        interacted(current);
      });
    };
    frame = requestAnimationFrame(update);
    document.addEventListener("click", capture, true);
    document.addEventListener("keydown", capture, true);
    document.addEventListener("change", capture, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(actionFrame);
      document.removeEventListener("click", capture, true);
      document.removeEventListener("keydown", capture, true);
      document.removeEventListener("change", capture, true);
    };
  }, [step, retry]);

  useLayoutEffect(() => {
    const measure = () =>
      setTooltipHeight(
        tooltip.current ? tooltip.current.scrollHeight + 2 : 240,
      );
    measure();
    const observer = new ResizeObserver(measure);
    if (tooltip.current) observer.observe(tooltip.current);
    return () => observer.disconnect();
  }, []);
  const ready = Boolean(rect) || missing;
  const interaction = variant?.interaction || "read";
  const clickRequired = interaction === "click" && !variant?.optional;
  useEffect(() => {
    const target = element.current;
    if (!ready) exit.current?.focus({ preventScroll: true });
    else if (
      !missing &&
      (clickRequired || interaction === "input") &&
      target &&
      !target.hasAttribute("disabled")
    )
      target.focus({ preventScroll: true });
    else primary.current?.focus({ preventScroll: true });
  }, [ready, missing, clickRequired, interaction]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onExit();
        return;
      }
      if (event.key !== "Tab") return;
      const control = element.current;
      const safe =
        variant?.interaction &&
        variant.interaction !== "read" &&
        rect &&
        control &&
        control.matches(
          "button,a[href],input:not([type=file]),select,summary,[role=button]",
        ) &&
        !control.hasAttribute("disabled")
          ? [control]
          : [];
      const buttons = Array.from(
        tooltip.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ) || [],
      );
      const choices = variant?.anyMatching
        ? Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-guide="' + variant.key + '"]',
            ),
          ).filter(
            (node) =>
              node.getClientRects().length && !node.hasAttribute("disabled"),
          )
        : safe;
      const focusable = [...choices, ...buttons];
      if (!focusable.length) return;
      event.preventDefault();
      const position = focusable.indexOf(document.activeElement as HTMLElement);
      const next =
        position < 0
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (position + (event.shiftKey ? -1 : 1) + focusable.length) %
            focusable.length;
      focusable[next]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [onExit, variant, rect]);

  const width = Math.min(336, viewport.width - 24);
  const horizontalChoices =
    rect &&
    variant?.anyMatching &&
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-guide="' + variant.key + '"]',
      ),
    ).some((node) => {
      const bounds = node.getBoundingClientRect();
      return (
        node !== element.current &&
        bounds.height > 0 &&
        bounds.top < rect.bottom &&
        bounds.bottom > rect.top
      );
    });
  const geometry = rect
    ? connectedGuideGeometry(
        rect,
        { width, height: tooltipHeight },
        viewport,
        Boolean(horizontalChoices),
      )
    : null;
  const nextDisabled = !ready || (!missing && clickRequired);
  const optional = Boolean(variant?.optional);
  const terminal = isLast || variant?.next === "finish";
  const proceed = () => {
    if (missing) onNext(null, true);
    else if (optional) onExit();
    else onNext(variant);
  };
  return createPortal(
    <div
      className="researcher-guide-walkthrough"
      data-researcher-walkthrough={step.id}
      data-guide-open-choice={variant?.anyMatching || undefined}
    >
      {rect && (
        <>
          <div
            className="researcher-guide-walkthrough__shade"
            style={{ top: 0, left: 0, right: 0, height: rect.top }}
          />
          <div
            className="researcher-guide-walkthrough__shade"
            style={{
              top: rect.top,
              left: 0,
              width: rect.left,
              height: rect.height,
            }}
          />
          <div
            className="researcher-guide-walkthrough__shade"
            style={{
              top: rect.top,
              left: rect.right,
              right: 0,
              height: rect.height,
            }}
          />
          <div
            className="researcher-guide-walkthrough__shade"
            style={{ top: rect.bottom, bottom: 0, left: 0, right: 0 }}
          />
          <div
            className="researcher-guide-walkthrough__ring"
            data-guide-highlight={variant?.key}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              pointerEvents: interaction === "read" ? "auto" : "none",
            }}
          />
        </>
      )}
      {geometry && (
        <svg
          className="researcher-guide-walkthrough__connector"
          aria-hidden="true"
          width={viewport.width}
          height={viewport.height}
        >
          <defs>
            <marker
              id={marker}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="currentColor" />
            </marker>
          </defs>
          <path
            data-guide-connector="true"
            data-target-x={geometry.end.x}
            data-target-y={geometry.end.y}
            d={geometry.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            markerEnd={`url(#${marker})`}
          />
        </svg>
      )}
      <div
        ref={tooltip}
        className="researcher-guide-walkthrough__tooltip"
        role="dialog"
        aria-labelledby="researcher-step-title"
        aria-describedby="researcher-step-text"
        style={{
          width,
          left: geometry?.left ?? Math.max(12, viewport.width - width - 16),
          top:
            geometry?.top ?? Math.max(12, viewport.height - tooltipHeight - 24),
          maxHeight: geometry?.maxHeight ?? viewport.height - 24,
        }}
      >
        <div className="researcher-guide-walkthrough__top">
          <span role="status" aria-live="polite">
            Step {index + 1}
            {total ? " of " + total : ""}
          </span>
          {rect && !terminal && (
            <button
              type="button"
              className="researcher-guide-walkthrough__skip"
              onClick={() => onNext(variant, true)}
            >
              Skip this step
            </button>
          )}
          <button
            ref={exit}
            type="button"
            aria-label="Exit walkthrough"
            onClick={onExit}
          >
            <X size={17} />
          </button>
        </div>
        <h2 id="researcher-step-title">{step.title}</h2>
        <p id="researcher-step-text" aria-live="polite">
          {missing
            ? step.fallback
            : !rect
              ? "Finding this control on the page…"
              : text}
        </p>
        {clickRequired && rect && (
          <p className="researcher-guide-walkthrough__hint">
            {variant?.anyMatching
              ? "Select the highlighted control or another matching record. You can use Tab and Enter."
              : "Select the highlighted control to continue. You can use Tab and Enter."}
          </p>
        )}
        {optional && rect && (
          <p className="researcher-guide-walkthrough__hint">
            You can use this control yourself, or finish for now.
          </p>
        )}
        <div className="researcher-guide-walkthrough__actions">
          <button type="button" onClick={onExit}>
            Exit
          </button>
          {canGoBack && (
            <button type="button" onClick={onBack}>
              <ArrowLeft size={14} />
              Back
            </button>
          )}
          {missing && (
            <button
              type="button"
              onClick={() => {
                onRetry();
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </button>
          )}
          <button
            ref={primary}
            type="button"
            className="researcher-guide__primary"
            disabled={nextDisabled}
            onClick={proceed}
          >
            {missing
              ? "Skip step"
              : optional
                ? "Finish for now"
                : terminal
                  ? "Finish"
                  : "Next"}
            {!terminal && !optional && <ArrowRight size={14} />}
          </button>
        </div>
        {isLast && (
          <button
            type="button"
            className="researcher-guide-walkthrough__explore"
            onClick={onExplore}
          >
            Explore help topics
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
