import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  isOfflineReadMode,
  OFFLINE_ACCESS_CHANGED,
} from "@/lib/offline/access";
import {
  loadOfflineSession,
  OFFLINE_CHANGED,
  type OfflineSession,
} from "@/lib/offline/store";

export function useConnectivity() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function useOfflineReadOnly() {
  const online = useConnectivity();
  const { isOfflineSession } = useAuth();
  const [limited, setLimited] = useState(isOfflineReadMode);
  useEffect(() => {
    const update = () => setLimited(isOfflineReadMode());
    window.addEventListener(OFFLINE_ACCESS_CHANGED, update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener(OFFLINE_ACCESS_CHANGED, update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return !online || Boolean(isOfflineSession) || limited;
}

export function useOfflineSession() {
  const { token, user } = useAuth();
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let expiry: ReturnType<typeof setTimeout>;
    const load = async () => {
      const value =
        user && token
          ? await loadOfflineSession(token).catch(() => null)
          : null;
      if (cancelled) return;
      setSession((previous) =>
        previous?.token === value?.token &&
        previous?.expiresAt === value?.expiresAt
          ? previous
          : value,
      );
      setLoading(false);
      clearTimeout(expiry);
      if (value)
        expiry = setTimeout(
          () => {
            setSession(null);
          },
          Math.max(0, value.expiresAt - Date.now()),
        );
    };
    setSession(null);
    setLoading(true);
    void load();
    window.addEventListener(OFFLINE_CHANGED, load);
    return () => {
      cancelled = true;
      clearTimeout(expiry);
      window.removeEventListener(OFFLINE_CHANGED, load);
    };
  }, [token, user?.id, user?.college?.id]);
  return { session: session?.token === token ? session : null, loading };
}
