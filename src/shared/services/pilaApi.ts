// PILA verification for credentials NOT issued by TOTM, in two steps:
//   1. PILA's verification context API (NDAKey POST /vp/verification-context, through the portal's server
//      /api/pila/context, NDAKey key added server side): issuer public key, issuer trust, live status;
//   2. PILA's official SDK on the TOTM Trust API (POST /api/v1/pila/verify, through /api/trust): integrity and issuer,
//      checking the signature with the issuer key from step 1. No DID is resolved.
// The result keeps one shape (checks + ndakey), so the Verify page shows both as before.
import { ApiError, http, type ApiResult } from './http';

export interface PilaCheck { passed: boolean; error?: string; skipped?: boolean }

export interface PilaVerifyResponse {
  format: 'json' | 'jwt';
  id?: string;
  holder?: string;
  issuer?: string;
  types?: string[];
  subject?: Record<string, unknown>;
  validFrom?: string;
  validUntil?: string;
  issuerSource?: string;
  /** The key the signature was checked with (from PILA's verification context, or recovered from the signature). */
  issuerPublicKey?: string;
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

/**
 * As in PILA's verifier guide (3.2): first the verification context (issuer key, trust, status), then PILA's SDK checks
 * the signature with that issuer key. No DID is resolved anywhere.
 */
export async function pilaVerify(credential: unknown): Promise<ApiResult<PilaVerifyResponse>> {
  const ids = credentialIds(credential);
  const requestId = crypto.randomUUID();
  const context = await pilaContext(ids.holderDid, ids.vcId, ids.issuerDid, requestId);
  const sdk = await http.post<PilaVerifyResponse>('/pila/verify', {
    credential,
    ...(context.didPublicKey ? { issuerPublicKey: context.didPublicKey } : {}),
  }, 45000);
  return { ...sdk, data: { ...sdk.data, ndakey: context } };
}

/**
 * The IDs PILA's verification context asks for, read from the credential: a W3C JSON credential's id / issuer /
 * credentialSubject.id, or a VC-JWT's vc claims with the JWT's jti / iss / sub when the vc body leaves them out.
 */
export function credentialIds(credential: unknown): { vcId?: string; issuerDid?: string; holderDid?: string } {
  let body: Record<string, unknown> | undefined;
  let claims: Record<string, unknown> = {};
  if (typeof credential === 'string') {
    try {
      const part = credential.split('~')[0].split('.')[1] ?? '';
      const json = decodeURIComponent(escape(atob(part.replace(/-/g, '+').replace(/_/g, '/'))));
      claims = JSON.parse(json);
      body = (claims.vc ?? claims) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (credential && typeof credential === 'object') {
    body = credential as Record<string, unknown>;
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const issuer = body?.issuer;
  const subject = Array.isArray(body?.credentialSubject) ? body?.credentialSubject[0] : body?.credentialSubject;
  return {
    vcId: str(body?.id) ?? str(claims.jti),
    issuerDid: str(issuer) ?? str((issuer as { id?: unknown } | undefined)?.id) ?? str(claims.iss),
    holderDid: str((subject as { id?: unknown } | undefined)?.id) ?? str(claims.sub),
  };
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
