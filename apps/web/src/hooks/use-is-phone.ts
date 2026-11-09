import { useSyncExternalStore } from "react";

/** Phone layouts apply below Tailwind's `md` breakpoint; keep in step with styles/phone.css. */
export const PHONE_MEDIA_QUERY = "(max-width: 767px)";

function phoneQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(PHONE_MEDIA_QUERY);
}

function subscribe(onChange: () => void) {
  const query = phoneQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

const isPhoneNow = () => phoneQuery()?.matches ?? false;
const isPhoneOnServer = () => false;

export function useIsPhone() {
  return useSyncExternalStore(subscribe, isPhoneNow, isPhoneOnServer);
}
