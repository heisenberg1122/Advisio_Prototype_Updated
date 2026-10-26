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
  const requestKey = mutationRequestKey(method, url, rest.body, requestHeaders);
  const existingRequest = requestKey ? inFlightMutations.get(requestKey) : null;
  if (existingRequest) return existingRequest as Promise<T>;

  const pendingRequest = (async () => {
    const response = await fetch(url, {
      headers: requestHeaders,
      ...rest,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || (response.status === 404 ? "Backend API service is unreachable (404). Please ensure the API server is running." : "An unexpected error occurred"),
        response.status,
        data.details
      );
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
    const token = typeof window !== "undefined" ? localStorage.getItem("advisio_token") : null;
    const response = await fetch(url.startsWith("http") ? url : `${API_BASE_URL}${url}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...panelRequestHeaders() },
    });
    if (!response.ok) {
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
