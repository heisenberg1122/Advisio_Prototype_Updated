import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type LandingTheme = "light" | "dark";
const storageKey = "advisio-landing-theme";

/** Marketing-page preference only; never changes the authenticated portal theme. */
export function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>(() => {
    try {
      return window.localStorage.getItem(storageKey) === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  const requestedTheme = useRef(theme);
  const requestId = useRef(0);
  const transitionRef = useRef<ViewTransition | null>(null);
  const animationRef = useRef<Animation | null>(null);

  useEffect(
    () => () => {
      requestId.current += 1;
      transitionRef.current?.skipTransition();
      animationRef.current?.cancel();
      document.documentElement.removeAttribute("data-landing-theme-reveal");
    },
    [],
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      /* The toggle still works when browser storage is unavailable. */
    }
  }, [theme]);
  const toggleTheme = async (button: HTMLElement) => {
    const id = ++requestId.current;
    const nextTheme = requestedTheme.current === "dark" ? "light" : "dark";
    requestedTheme.current = nextTheme;
    transitionRef.current?.skipTransition();
    animationRef.current?.cancel();
    transitionRef.current = null;
    animationRef.current = null;

    let applied = false;
    const applyTheme = () => {
      if (id !== requestId.current) return;
      flushSync(() => setTheme(nextTheme));
      applied = true;
    };
    const root = document.documentElement;
    if (
      !document.startViewTransition ||
      !root.animate ||
      !CSS.supports("clip-path", "circle(1px at 1px 1px)")
    ) {
      root.removeAttribute("data-landing-theme-reveal");
      applyTheme();
      return;
    }

    // Button center also gives keyboard activation a predictable reveal origin.
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      ),
    );
    root.setAttribute("data-landing-theme-reveal", "active");

    try {
      const transition = document.startViewTransition(applyTheme);
      transitionRef.current = transition;
      // A superseded transition may reject before its ready promise is handled.
      void transition.finished.catch(() => {});
      await transition.ready;
      if (id !== requestId.current) return;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const animation = root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: reducedMotion ? 220 : 650,
          easing: "cubic-bezier(0.22, 0.68, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
          fill: "both",
        },
      );
      animationRef.current = animation;
      await animation.finished;
      await transition.finished;
    } catch {
      // Unsupported, interrupted or hidden-tab transitions still apply the theme.
      if (!applied) applyTheme();
    } finally {
      if (id === requestId.current) {
        transitionRef.current = null;
        animationRef.current?.cancel();
        animationRef.current = null;
        root.removeAttribute("data-landing-theme-reveal");
      }
    }
  };
  return { theme, toggleTheme };
}
