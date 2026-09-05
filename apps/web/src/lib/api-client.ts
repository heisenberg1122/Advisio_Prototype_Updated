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

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

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
};
