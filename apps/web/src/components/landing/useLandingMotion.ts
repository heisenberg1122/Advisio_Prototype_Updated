import { useEffect, useRef } from "react";

/** Progressive enhancement: content stays visible if observers are unavailable. */
export function useLandingMotion() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    const html = document.documentElement;
    const hadScrollClass = html.classList.contains("advisio-landing-scroll");
    html.classList.add("advisio-landing-scroll");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(
      page.querySelectorAll<HTMLElement>(
        "main > section:not(#hero) > div > div, [data-reveal]",
      ),
    ).filter((target) => !target.querySelector("[data-reveal]"));
    let observer: IntersectionObserver | undefined;
    const revealed = new WeakSet<Element>();
    const showAll = () =>
      targets.forEach((target) =>
        target.classList.remove("landing-reveal-pending"),
      );
    const configure = () => {
      observer?.disconnect();
      showAll();
      if (preference.matches || !("IntersectionObserver" in window)) {
        targets.forEach((target) => revealed.add(target));
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            target.classList.remove("landing-reveal-pending");
            revealed.add(target);
            observer?.unobserve(target);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -32px 0px" },
      );
      targets.forEach((target, index) => {
        // Never hide content already visible, including initial hash destinations.
        if (revealed.has(target)) return;
        if (target.getBoundingClientRect().top < window.innerHeight) {
          revealed.add(target);
          return;
        }
        target.classList.add("landing-reveal", "landing-reveal-pending");
        target.style.setProperty("--reveal-delay", `${(index % 3) * 60}ms`);
        observer?.observe(target);
      });
    };
    const revealFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      targets.forEach((target) => {
        if (target.contains(event.target as Node)) {
          target.classList.remove("landing-reveal-pending");
          revealed.add(target);
          observer?.unobserve(target);
        }
      });
    };
    const finishReveal = (event: TransitionEvent) => {
      if (
        event.target instanceof HTMLElement &&
        !event.target.classList.contains("landing-reveal-pending")
      ) {
        // Return cards to their shorter hover duration after the entrance ends.
        event.target.classList.remove("landing-reveal");
      }
    };
    configure();
    preference.addEventListener("change", configure);
    page.addEventListener("focusin", revealFocused);
    page.addEventListener("transitionend", finishReveal);
    return () => {
      observer?.disconnect();
      showAll();
      preference.removeEventListener("change", configure);
      page.removeEventListener("focusin", revealFocused);
      page.removeEventListener("transitionend", finishReveal);
      if (!hadScrollClass) html.classList.remove("advisio-landing-scroll");
    };
  }, []);
  return root;
}
