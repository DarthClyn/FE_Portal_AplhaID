// PILA verification for credentials NOT issued by TOTM: the portal proxy (/api/pila, signed-in users only) forwards to
// the pila-verifier service, which runs PILA's official Go SDK and NDAKey's verification context API.
import { ApiError } from './http';

export interface PilaCheck { passed: boolean; error?: string; skipped?: boolean }

export interface PilaVerifyResponse {
  format: 'json' | 'jwt';
  id?: string;
  holder?: string;
  issuer?: string;
  issuerRegistry?: { checked: boolean; registered: boolean; type?: string; error?: string };
  types?: string[];
  subject?: Record<string, unknown>;
  validFrom?: string;
  validUntil?: string;
  issuerSource?: string;
  checks: { issuer: PilaCheck; signature: PilaCheck; expiration: PilaCheck; revocation: PilaCheck };
  ndakey: {
    called: boolean;
    requestId?: string;
    status?: string; // active | revoked | expired | verified | not_found
    isIssuerTrusted?: boolean;
    didPublicKey?: string | null;
    error?: string;
    skipped?: string;
  };
  sdk: string;
}

export async function pilaVerify(credential: unknown): Promise<{ data: PilaVerifyResponse; requestId: string }> {
  const requestId = crypto.randomUUID();
  let res: Response;
  try {
    res = await fetch('/api/pila/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': requestId },
      body: JSON.stringify({ credential }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new ApiError('Could not reach the PILA verifier.', 0, 'NETWORK', requestId);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status >= 500 && !body.error ? 'The PILA verifier is not running or not reachable.' : (body.error ?? `PILA verification failed (${res.status})`);
    throw new ApiError(msg, res.status, body.code ?? `HTTP${res.status}`, requestId);
  }
  return { data: body as PilaVerifyResponse, requestId };
}
