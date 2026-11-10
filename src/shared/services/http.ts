// Thin fetch wrapper for the TOTM Trust API, called through the portal proxy (/api/trust → /api/v1, admin key added
// server side, signed-in users only). Every call carries an X-Request-Id (correlation ID); the proxy adds the
// signed-in user's name (X-Actor) for the audit log.
import { SIGNED_OUT } from './auth';

export const API_BASE = '/api/trust';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string,
  ) {
    super(message);
  }
  /** Network failures, timeouts and 5xx: the check could not be completed. */
  get isUnavailable() {
    return this.status === 0 || this.status >= 500;
  }
}

export interface ApiResult<T> {
  data: T;
  requestId: string;
}

const uuid = () => crypto.randomUUID();

async function request(method: string, path: string, init: { json?: unknown; timeoutMs?: number } = {}) {
  const requestId = uuid();
  const headers: Record<string, string> = { 'X-Request-Id': requestId };
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 30000),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === 'TimeoutError';
    throw new ApiError(timeout ? 'The service did not respond in time.' : 'Could not reach the service.', 0, 'NETWORK', requestId);
  }
  if (res.status === 401 && res.headers.get('content-type')?.includes('json')) {
    const b = await res.clone().json().catch(() => ({}));
    if (b.code === 'E_SESSION') window.dispatchEvent(new Event(SIGNED_OUT));
  }
  return { res, requestId: res.headers.get('x-request-id') ?? requestId };
}

async function json<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<ApiResult<T>> {
  const { res, requestId } = await request(method, path, { json: body, timeoutMs });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.code !== 'E00') {
    throw new ApiError(payload.error ?? `Request failed (${res.status})`, res.status, payload.code ?? `HTTP${res.status}`, requestId);
  }
  return { data: payload.data as T, requestId };
}

export const http = {
  get: <T>(path: string, timeoutMs?: number) => json<T>('GET', path, undefined, timeoutMs),
  post: <T>(path: string, body?: unknown, timeoutMs?: number) => json<T>('POST', path, body ?? {}, timeoutMs),
  /** Raw bytes (file downloads). */
  async blob(path: string): Promise<{ blob: Blob; sha256: string | null; requestId: string }> {
    const { res, requestId } = await request('GET', path);
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      throw new ApiError(p.error ?? `Download failed (${res.status})`, res.status, p.code ?? `HTTP${res.status}`, requestId);
    }
    return { blob: await res.blob(), sha256: res.headers.get('x-file-sha256'), requestId };
  },
};
