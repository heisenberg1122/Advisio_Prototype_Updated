import { useEffect, useRef, type PointerEvent } from "react";

export function FooterSpotlightWordmark() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => () => window.cancelAnimationFrame(frameRef.current), []);

  const moveSpotlight = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      const light = lightRef.current;
      const root = rootRef.current;
      if (!light || !root) return;
      const bounds = light.getBoundingClientRect();
      light.style.setProperty(
        "--lp-spotlight-x",
        `${pointerRef.current.x - bounds.left}px`,
      );
      light.style.setProperty(
        "--lp-spotlight-y",
        `${pointerRef.current.y - bounds.top}px`,
      );
      root.setAttribute("data-spotlight-active", "true");
    });
  };

  const hideSpotlight = () => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    rootRef.current?.removeAttribute("data-spotlight-active");
  };

  return (
    <div
      ref={rootRef}
      className="lp-footer-wordmark"
      aria-hidden="true"
      onPointerEnter={moveSpotlight}
      onPointerMove={moveSpotlight}
      onPointerLeave={hideSpotlight}
      onPointerCancel={hideSpotlight}
    >
      <span className="lp-footer-wordmark-dim">advisio.</span>
      <span ref={lightRef} className="lp-footer-wordmark-lit">
        advisio.
      </span>
    </div>
  );
}
