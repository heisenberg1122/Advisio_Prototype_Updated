import React, { useEffect } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useLocation } from "react-router-dom";
import { uiMotion } from "@/lib/ui-motion";

// Animate content in place. Children stay mounted, so query and form state survive.
export function WorkspaceMotion({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation();
  const tab = new URLSearchParams(search).get("tab");
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    controls.set({ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 7 });
    void controls.start({
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : uiMotion.page,
        ease: uiMotion.ease,
      },
    });
  }, [pathname, tab, controls, reduceMotion]);
  return (
    <motion.div className="flex min-w-0 flex-1 flex-col" animate={controls}>
      {children}
    </motion.div>
  );
}
