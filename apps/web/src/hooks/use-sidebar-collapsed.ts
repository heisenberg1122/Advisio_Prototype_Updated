"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "advisio-sidebar-collapsed";

// Set up a simple subscription system for the sidebar collapse state
const listeners = new Set<(val: boolean) => void>();
let globalCollapsed = false;
const mobileListeners = new Set<(val: boolean) => void>();
let globalMobileOpen = false;

// Initialize from localStorage if on client
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      globalCollapsed = stored === "true";
    }
  } catch {}
}

const notify = (val: boolean) => {
  for (const listener of listeners) {
    listener(val);
  }
};

const notifyMobile = (val: boolean) => {
  for (const listener of mobileListeners) {
    listener(val);
  }
};

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(globalCollapsed);
  const [mobileOpen, setMobileOpen] = useState(globalMobileOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(globalCollapsed);

    const handleListener = (val: boolean) => {
      setCollapsed(val);
    };

    const handleMobileListener = (val: boolean) => {
      setMobileOpen(val);
    };

    listeners.add(handleListener);
    mobileListeners.add(handleMobileListener);
    return () => {
      listeners.delete(handleListener);
      mobileListeners.delete(handleMobileListener);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !globalCollapsed;
    globalCollapsed = next;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
    notify(next);
  }, []);

  const openMobile = useCallback(() => {
    globalMobileOpen = true;
    notifyMobile(true);
  }, []);

  const closeMobile = useCallback(() => {
    globalMobileOpen = false;
    notifyMobile(false);
  }, []);

  return {
    collapsed: mounted ? collapsed : false,
    toggle,
    mobileOpen: mounted ? mobileOpen : false,
    openMobile,
    closeMobile,
  };
}
