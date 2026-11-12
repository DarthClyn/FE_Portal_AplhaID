// PILA verification for credentials NOT issued by TOTM, in two parts:
//   1. integrity + signature (and issuer DID, expiry, revocation): PILA's official SDK on the TOTM Trust API,
//      POST /api/v1/pila/verify (through the portal proxy /api/trust, admin key added server side);
//   2. issuer trust + live status: PILA's own verification context API (NDAKey POST /vp/verification-context), through
//      the portal's server (/api/pila/context, NDAKey key added server side).
// The result keeps one shape (checks + ndakey), so the Verify page shows both as before.
import { ApiError, http, type ApiResult } from './http';

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
  /** From PILA's verification context API (not the SDK). */
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

export async function pilaVerify(credential: unknown): Promise<ApiResult<PilaVerifyResponse>> {
  const sdk = await http.post<PilaVerifyResponse>('/pila/verify', { credential }, 45000);
  const r = sdk.data;
  return { ...sdk, data: { ...r, ndakey: await pilaContext(r.holder, r.id, r.issuer, sdk.requestId) } };
}

/** PILA's verification context for one credential; never throws (a failure shows as "could not check"). */
async function pilaContext(holderDid: string | undefined, vcId: string | undefined, issuerDid: string | undefined, requestId: string): Promise<PilaVerifyResponse['ndakey']> {
  try {
    const res = await fetch('/api/pila/context', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': requestId },
      body: JSON.stringify({ holderDid, vcId, issuerDid }),
      signal: AbortSignal.timeout(25000),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok || b.code !== 'E00') throw new ApiError(b.error ?? `HTTP ${res.status}`, res.status, b.code ?? 'HTTP', requestId);
    return b.data;
  } catch (e) {
    return { called: true, error: `PILA verification context: ${(e as Error).message}` };
  }
}
