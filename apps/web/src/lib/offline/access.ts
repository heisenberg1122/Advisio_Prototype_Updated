let offlineOnly = false;

export function setOfflineOnly(value: boolean) {
  offlineOnly = value;
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
