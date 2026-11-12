// PILA's verification context API (NDAKey "Verifier" guide, POST /vp/verification-context), server side only (Vite dev
// middleware and the Vercel function share this file). It answers, per credential, whether the issuer is trusted and
// the credential's live status. The NDAKey verifier key (PILA_PARTNER_API_KEY) stays here, never in the browser.
// Integrity and signature are checked separately by PILA's SDK on the TOTM Trust API (POST /api/v1/pila/verify).

const DEFAULT_URL = 'https://api-beta.ndakey.vn/service/api/v1';
const str = (v, max = 300) => typeof v === 'string' && v.length > 0 && v.length <= max;

/**
 * body: { holderDid, vcId, issuerDid }. Returns the `ndakey` result the Verify page shows:
 * { called, requestId?, status?, isIssuerTrusted?, didPublicKey?, error?, skipped? }.
 */
export async function verificationContext(env, body, requestId) {
  const base = (env.PILA_NDAKEY_URL || DEFAULT_URL).replace(/\/$/, '');
  const key = env.PILA_PARTNER_API_KEY;
  if (!key) return { called: false, skipped: 'no NDAKey verifier key configured (PILA_PARTNER_API_KEY)' };
  const { holderDid, vcId, issuerDid } = body ?? {};
  if (!str(vcId) || !str(issuerDid)) return { called: false, skipped: 'the credential has no ID or issuer' };
  if (!str(holderDid)) return { called: false, skipped: 'the credential has no holder DID (credentialSubject.id), which NDAKey needs' };
  let res;
  try {
    res = await fetch(`${base}/vp/verification-context`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, ...(requestId ? { 'x-request-id': requestId } : {}) },
      body: JSON.stringify({ holderDid, vcIds: [{ vcId, issuerDid }] }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { called: true, error: `NDAKey not reachable: ${e.name === 'TimeoutError' ? 'timed out' : e.message}` };
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.data) return { called: true, error: `NDAKey verification context: HTTP ${res.status} ${out?.code ?? ''} ${out?.error ?? ''}`.trim() };
  const vcs = Array.isArray(out.data.vcs) ? out.data.vcs : [];
  if (!vcs.length) return { called: true, error: 'NDAKey verification context: no answer for this credential' };
  const v = vcs.find((x) => x.vcid === vcId || x.vcId === vcId) ?? vcs[0];
  return {
    called: true,
    requestId: out.data.requestId || res.headers.get('x-request-id') || undefined,
    status: v.status,
    isIssuerTrusted: !!v.isIssuerTrusted,
    didPublicKey: v.didPublicKey ?? null,
  };
}

/** Node http handler for POST /api/pila/context (body: JSON). Session is checked by the caller. */
export async function handlePilaContext(req, res, env) {
  const send = (code, data) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') return send(405, { code: 'E405', error: 'POST only' });
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 10000) return send(413, { code: 'E400', error: 'Body too large' }); }
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return send(400, { code: 'E400', error: 'Malformed JSON' }); }
  const rid = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;
  return send(200, { code: 'E00', message: 'Success', data: await verificationContext(env, body, rid) });
}
