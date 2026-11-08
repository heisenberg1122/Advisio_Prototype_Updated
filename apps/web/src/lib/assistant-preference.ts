import { useSyncExternalStore } from "react";

const changeEvent = "advisio-assistant-preference";
const temporary = new Map<string, boolean>();
export const assistantPreferenceKey = (userId: string) =>
  "advisio:assistant-visible:v1:" + encodeURIComponent(userId);
export function readAssistantPreference(userId?: string) {
  if (!userId) return false;
  try {
    const saved = localStorage.getItem(assistantPreferenceKey(userId));
    if (saved === "false") return false;
    if (saved === "true") return true;
  } catch {
    /* Use the current session when browser storage is blocked. */
  }
  return temporary.get(userId) ?? true;
}
export function saveAssistantPreference(userId: string, visible: boolean) {
  temporary.set(userId, visible);
  let persisted = false;
  try {
    localStorage.setItem(assistantPreferenceKey(userId), String(visible));
    persisted = true;
  } catch {}
  window.dispatchEvent(new Event(changeEvent));
  return persisted;
}
const subscribe = (listener: () => void) => {
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", listener);
  };
};
export function useAssistantVisibility(userId?: string) {
  const visible = useSyncExternalStore(
    subscribe,
    () => readAssistantPreference(userId),
    () => false,
  );
  return {
    visible,
    setVisible: (value: boolean) =>
      userId ? saveAssistantPreference(userId, value) : false,
  };
}
