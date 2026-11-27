let offlineOnly = false;
export const OFFLINE_ACCESS_CHANGED = "advisio:offline-access";

export function setOfflineOnly(value: boolean) {
  if (offlineOnly === value) return;
  offlineOnly = value;
  if (typeof window !== "undefined") window.dispatchEvent?.(new Event(OFFLINE_ACCESS_CHANGED));
}

export function isOfflineReadMode() {
  return offlineOnly || (typeof navigator !== "undefined" && navigator.onLine === false);
}

export function supportsOfflinePage(pathname: string, search = "") {
  if (/^\/student\/(tasks(?:\/[^/]+)?|documents)\/?$/.test(pathname)) return true;
  return ["/student/dashboard", "/dashboard"].includes(pathname) &&
    [null, "overview", "group", "my-group", "milestones", "progress"].includes(new URLSearchParams(search).get("tab"));
}

export function requiresConnection(method: string, endpoint: string) {
  if (offlineOnly && !(method === "GET" && endpoint === "/api/auth/me"))
    return true;
  return (
    method !== "GET" &&
    method !== "HEAD" &&
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  );
}
