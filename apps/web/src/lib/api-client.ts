import { isOfflineReadMode, requiresConnection, setOfflineOnly } from "./offline/access";
import { cachedFile, cachedResponse, currentOfflineSession, evictResponse, offlineResponsePath, OFFLINE_SAVE_ERROR, saveResponse, SESSION_REJECTED } from "./offline/cache";
import { clearOfflineStorage, listOffline, removeOffline, type OfflineFile } from "./offline/store";

export class ApiError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const inFlightMutations = new Map<string, Promise<unknown>>();

function serializeRequestBody(body: BodyInit | null | undefined): string | null {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return JSON.stringify(
      Array.from(body.entries()).map(([name, value]) =>
        typeof value === "string"
          ? [name, value]
          : [name, value.name, value.size, value.type, value.lastModified],
      ),
    );
  }
  return null;
}

function mutationRequestKey(
  method: string,
  url: string,
  body: BodyInit | null | undefined,
  headers: Record<string, string>,
) {
  if (method === "GET" || method === "HEAD") return null;
  const serializedBody = serializeRequestBody(body);
  if (serializedBody === null) return null;
  const relevantHeaders = Object.entries(headers).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify([method, url, serializedBody, relevantHeaders]);
}

export function panelRequestHeaders(): Record<string, string> {
  return typeof window !== "undefined" && /^\/student(?:\/|$)/.test(window.location?.pathname || "")
    ? { "X-Advisio-Panel": "researcher" }
    : {};
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...rest } = options;

  let url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("advisio_token") : null;
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...panelRequestHeaders(),
    ...(headers as Record<string, string>),
  };

  const method = (rest.method || "GET").toUpperCase();
  const base = API_BASE_URL || (typeof window !== "undefined" ? window.location?.origin : undefined) || "http://localhost";
  const cachePath = method === "GET" ? offlineResponsePath(url, base) : null;
  const candidate = cachePath && requestHeaders.Authorization === `Bearer ${token}` ? await currentOfflineSession() : null;
  const savedSession = candidate?.token === token ? candidate : null;
  if (method === "GET" && endpoint !== "/api/auth/me" && isOfflineReadMode()) {
    const saved = savedSession && cachePath ? await cachedResponse<T>(savedSession, cachePath) : undefined;
    if (saved !== undefined) { setOfflineOnly(true); return saved; }
    throw new ApiError("This information has not been saved on this device. Reconnect to load it.", 0);
  }
  if (requiresConnection(method, endpoint)) {
    throw new ApiError("Reconnect and verify your session before continuing. Your draft has not been submitted.", 0);
  }
  const requestKey = mutationRequestKey(method, url, rest.body, requestHeaders);
  const existingRequest = requestKey ? inFlightMutations.get(requestKey) : null;
  if (existingRequest) return existingRequest as Promise<T>;

  const pendingRequest = (async () => {
    let response: Response;
    try {
      response = await fetch(url, { headers: requestHeaders, ...rest });
    } catch (error) {
      if (error instanceof TypeError && savedSession && cachePath && !rest.signal?.aborted) {
        const saved = await cachedResponse<T>(savedSession, cachePath);
        if (saved !== undefined) { setOfflineOnly(true); return saved; }
      }
      throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (savedSession && response.status === 401) {
        await clearOfflineStorage();
        window.dispatchEvent(new Event(SESSION_REJECTED));
      } else if (savedSession && cachePath && [403, 404].includes(response.status)) {
        await evictResponse(savedSession, cachePath);
      }
      throw new ApiError(
        data.error || data.message || (response.status === 404 ? "Backend API service is unreachable (404). Please ensure the API server is running." : "An unexpected error occurred"),
        response.status,
        data.details
      );
    }

    if (savedSession && cachePath && localStorage.getItem("advisio_token") === token) {
      try { await saveResponse(savedSession, cachePath, data); }
      catch { window.dispatchEvent(new Event(OFFLINE_SAVE_ERROR)); }
    }

    return data as T;
  })();

  if (!requestKey) return pendingRequest;
  const trackedRequest = pendingRequest.finally(() => {
    if (inFlightMutations.get(requestKey) === trackedRequest) {
      inFlightMutations.delete(requestKey);
    }
  });
  inFlightMutations.set(requestKey, trackedRequest);
  return trackedRequest;
}

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) => request<T>(url, { method: "GET", ...options }),
  post: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body), ...options }),
  patch: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body), ...options }),
  put: <T>(url: string, body?: any, options?: RequestOptions) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body), ...options }),
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { method: "DELETE", ...options }),
  upload: <T>(url: string, body: FormData, options?: RequestOptions) =>
    request<T>(url, { method: "POST", body, ...options }),
  file: async (url: string, options: { expectedMimeType?: string } = {}) => {
    const savedSession = await currentOfflineSession();
    const base = API_BASE_URL || (typeof window !== "undefined" ? window.location?.origin : undefined) || "http://localhost";
    const readSaved = async () => {
      const blob = savedSession ? await cachedFile(savedSession, url, base) : null;
      if (blob && options.expectedMimeType && blob.type.split(";")[0].toLowerCase() !== options.expectedMimeType.split(";")[0].toLowerCase()) {
        throw new ApiError("The saved file has an unexpected file type. Reconnect and save it again.", 0);
      }
      return blob;
    };
    if (isOfflineReadMode()) {
      const blob = await readSaved();
      if (blob) return blob;
      throw new ApiError("This file is not available offline. Reconnect and choose Make available offline beside the file.", 0);
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("advisio_token") : null;
    let response: Response;
    try {
      response = await fetch(url.startsWith("http") ? url : `${API_BASE_URL}${url}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...panelRequestHeaders() },
      });
    } catch (error) {
      if (error instanceof TypeError) {
        const blob = await readSaved();
        if (blob) { setOfflineOnly(true); return blob; }
      }
      throw error;
    }
    if (!response.ok) {
      if (savedSession && [401, 403, 404].includes(response.status)) {
        if (response.status === 401) { await clearOfflineStorage(); window.dispatchEvent(new Event(SESSION_REJECTED)); }
        else {
          const path = new URL(url, base).pathname;
          for (const file of await listOffline<OfflineFile>(savedSession, "file:")) {
            if (file.value.url && new URL(file.value.url, base).pathname === path) await removeOffline(savedSession, file.key);
          }
        }
      }
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data.error || data.message || "The file could not be opened.", response.status, data.details);
    }
    const blob = await response.blob();
    const expectedType = options.expectedMimeType?.split(";")[0].trim().toLowerCase();
    const actualType = blob.type.split(";")[0].trim().toLowerCase();
    if (expectedType && actualType !== expectedType) {
      throw new ApiError(
        "The document could not be loaded because the server returned an unexpected file type. Please try again or contact support.",
        response.status,
      );
    }
    if (!blob.size) {
      throw new ApiError("The document could not be loaded because the file is empty.", response.status);
    }
    return blob;
  },
};
