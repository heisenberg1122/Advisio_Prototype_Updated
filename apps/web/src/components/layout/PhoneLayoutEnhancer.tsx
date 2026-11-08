"use client";

import { useEffect } from "react";
import { useIsPhone } from "@/hooks/use-is-phone";
import { enhancePhoneLayout, resetPhoneLayout } from "@/lib/phone-tables";

/** Keeps phone-only table rows and tab positions in step with rendered content. */
export function PhoneLayoutEnhancer({ rootRef }: { rootRef: React.RefObject<HTMLElement | null> }) {
  const isPhone = useIsPhone();

  useEffect(() => {
    const root = rootRef.current;
    if (!isPhone || !root) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhancePhoneLayout(root);
      });
    };
    enhancePhoneLayout(root);
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      resetPhoneLayout(root);
    };
  }, [isPhone, rootRef]);

  return null;
}
