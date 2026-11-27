import type { UserProfile } from "@/providers/auth-provider";

const DATABASE = "advisio-offline-v1";
const STORE = "records";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_CHANGED = "advisio:offline-changed";
export const OFFLINE_ENABLED = "advisio_offline_enabled";

export type OfflineSession = {
  scope: string;
  tokenHash: string;
  user: UserProfile;
  expiresAt: number;
  // Only present in memory. The existing auth token is never copied into IndexedDB.
  token: string;
};
type StoredSession = Omit<OfflineSession, "token">;
type RecordEntry<T = unknown> = {
  key: string;
  scope: string;
  value: T;
  savedAt: number;
};
let database: Promise<IDBDatabase> | undefined;
let hashCache: { token: string; hash: Promise<string> } | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error("Offline storage is unavailable in this browser."),
    );
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, {
          keyPath: "key",
        });
        store.createIndex("scope", "scope");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("Close other Advisio tabs and try again."));
      };
    });
  }
  return database;
}

function changed() {
  window.dispatchEvent(new Event(OFFLINE_CHANGED));
}

async function tokenHash(token: string) {
  if (hashCache?.token !== token) {
    hashCache = {
      token,
      hash: crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(token))
        .then((digest) =>
          Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        ),
    };
  }
  return hashCache.hash;
}

export function offlineExpiry(token: string, now = Date.now()): number {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" && Number.isFinite(exp)
      ? Math.min(exp * 1000, now + MAX_AGE)
      : 0;
  } catch {
    return 0;
  }
}

export async function loadOfflineSession(
  token: string | null,
): Promise<OfflineSession | null> {
  if (!token || token === "__evaluation__") return null;
  const hash = await tokenHash(token);
  const db = await openDatabase();
  const stored = await new Promise<RecordEntry<StoredSession> | undefined>(
    (resolve, reject) => {
      const request = db
        .transaction(STORE)
        .objectStore(STORE)
        .get(`session:${hash}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );
  if (
    !stored ||
    stored.value.expiresAt <= Date.now() ||
    localStorage.getItem("advisio_token") !== token
  )
    return null;
  return { ...stored.value, token };
}

export async function enableOfflineStorage(
  user: UserProfile,
  token: string,
): Promise<OfflineSession> {
  if (
    !user.roles.some((role) =>
      ["RESEARCHER", "STUDENT"].includes(role.toUpperCase()),
    ) ||
    offlineExpiry(token) <= Date.now()
  ) {
    throw new Error(
      "Sign in online with a researcher account before enabling offline access.",
    );
  }
  const hash = await tokenHash(token);
  if (localStorage.getItem("advisio_token") !== token)
    throw new Error("Your session changed. Please try again.");
  const session: StoredSession = {
    scope: `${user.universityId}:${user.id}:${user.college?.id || "unassigned"}`,
    tokenHash: hash,
    // Cached identity opens only the offline researcher workspace, never faculty tools.
    user: {
      ...user,
      roles: ["RESEARCHER"],
      permissions: [],
      collegeMemberships: [],
    },
    expiresAt: offlineExpiry(token),
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    if (localStorage.getItem("advisio_token") !== token) {
      transaction.abort();
      reject(new Error("Your session changed. Please try again."));
      return;
    }
    transaction
      .objectStore(STORE)
      .put({
        key: `session:${hash}`,
        scope: session.scope,
        value: session,
        savedAt: Date.now(),
      });
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        transaction.error || new Error("Offline storage could not be enabled."),
      );
  });
  localStorage.setItem(OFFLINE_ENABLED, "1");
  changed();
  return { ...session, token };
}

export async function readOffline<T>(
  session: OfflineSession,
  key: string,
): Promise<RecordEntry<T> | undefined> {
  if (
    session.expiresAt <= Date.now() ||
    localStorage.getItem("advisio_token") !== session.token
  )
    return undefined;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE);
    const store = transaction.objectStore(STORE);
    const identity = store.get(`session:${session.tokenHash}`);
    identity.onsuccess = () => {
      if (!identity.result) {
        resolve(undefined);
        return;
      }
      const request = store.get(`${session.scope}:${key}`);
      request.onsuccess = () =>
        resolve(
          localStorage.getItem("advisio_token") === session.token
            ? request.result
            : undefined,
        );
    };
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function writeOffline<T>(
  session: OfflineSession,
  key: string,
  value: T,
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const identity = store.get(`session:${session.tokenHash}`);
    let denied = false;
    identity.onsuccess = () => {
      if (
        !identity.result ||
        session.expiresAt <= Date.now() ||
        localStorage.getItem("advisio_token") !== session.token
      ) {
        denied = true;
        transaction.abort();
        return;
      }
      try {
        store.put({
          key: `${session.scope}:${key}`,
          scope: session.scope,
          value,
          savedAt: Date.now(),
        });
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        denied
          ? new Error(
              "Offline access expired or your session changed. Reconnect and sign in again.",
            )
          : transaction.error ||
              new Error(
                "This device could not save your work. Free some storage and try again.",
              ),
      );
  });
  changed();
}

export async function removeOffline(session: OfflineSession, key: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(`${session.scope}:${key}`);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  changed();
}

export async function clearOfflineStorage() {
  localStorage.removeItem(OFFLINE_ENABLED);
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  changed();
}

export type OfflineDraft = { text: string; title: string; updatedAt: number };
export type OfflineFile = { name: string; blob: Blob; savedAt: number };

export async function listOffline<T>(
  session: OfflineSession,
  prefix: string,
): Promise<Array<{ key: string; value: T }>> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE);
    const store = transaction.objectStore(STORE);
    const identity = store.get(`session:${session.tokenHash}`);
    identity.onsuccess = () => {
      if (
        !identity.result ||
        session.expiresAt <= Date.now() ||
        localStorage.getItem("advisio_token") !== session.token
      ) {
        resolve([]);
        return;
      }
      const request = store.index("scope").getAll(session.scope);
      request.onsuccess = () =>
        resolve(
          localStorage.getItem("advisio_token") !== session.token
            ? []
            : request.result
                .filter((entry: RecordEntry<T>) =>
                  entry.key.startsWith(`${session.scope}:${prefix}`),
                )
                .map((entry: RecordEntry<T>) => ({
                  key: entry.key.slice(session.scope.length + 1),
                  value: entry.value,
                })),
        );
    };
    transaction.onabort = () => reject(transaction.error);
  });
}
