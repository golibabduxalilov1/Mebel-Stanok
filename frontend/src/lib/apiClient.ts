// REST client for the StankoBase backend (see ../../backend). Replaces the direct
// Firestore SDK calls that used to live in machineService.ts / userService.ts.

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Access token lives only in memory - never localStorage - so a page refresh always
// re-derives it from the httpOnly refresh cookie via refreshAccessToken().
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data.accessToken;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
  parseJson?: boolean;
  /** Internal: prevents infinite retry loops when the retried request itself 401s. */
  _retried?: boolean;
}

async function request<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, isForm = false, parseJson = true, _retried = false } = opts;

  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && !_retried && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
  }

  if (!res.ok) {
    let error = `Request failed with status ${res.status}`;
    let code = 'REQUEST_FAILED';
    try {
      const data = await res.json();
      if (data?.error) error = data.error;
      if (data?.code) code = data.code;
    } catch {
      // Response wasn't JSON - keep the generic message.
    }
    throw new ApiError(res.status, code, error);
  }

  if (res.status === 204 || !parseJson) return undefined as T;
  return res.json();
}

export const apiClient = {
  get<T = any>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T = any>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },
  put<T = any>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body });
  },
  patch<T = any>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body });
  },
  delete<T = any>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
  upload<T = any>(path: string, form: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body: form, isForm: true });
  },

  /** For attachment download/thumbnail routes, which need the auth header and can't be a plain <img src>. */
  async getBlob(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, 'REQUEST_FAILED', `Failed to fetch ${path}`);
    return res.blob();
  },

  tryRefresh: refreshAccessToken,
};
