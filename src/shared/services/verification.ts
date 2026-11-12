// Verifies a credential and maps the answer to the four checks of the design (Integrity, Status, Issuer, Trusted issuer).
//
// Who verifies depends on who issued it:
//   - issued by a bank in the TOTM issuer registry → TOTM Trust API (TrustVC content check + verification context);
//   - anything else (PILA-issued eLCs, VC-JWTs, did:nda issuers…) → PILA: the Trust API's /pila/verify runs PILA's Go SDK and
//     NDAKey's verification context API.
import { JURISDICTIONS, PORTAL, jurisdictionFromBic, type Jurisdiction } from '@/config/portal';
import { ApiError } from './http';
import { pilaVerify, type PilaVerifyResponse } from './pilaApi';
import { trustApi, type BankEntry, type ElcStatus } from './trustApi';
import { daysUntil, fmtDate, fmtDateTime } from './format';

export type CheckState = 'pass' | 'fail' | 'error';
export type Platform = 'TOTM' | 'PILA';

export interface Check {
  id: 'integrity' | 'status' | 'issuer' | 'trusted';
  title: string;
  question: string;
  state: CheckState;
  detail: { text: string; state: CheckState }[];
  /** Supporting facts from the APIs, the SDK and the credential itself (shown under the check). */
  facts?: Fact[];
}

export interface Fact { label: string; value: string; mono?: boolean; copy?: boolean }

export interface Verification {
  platform: Platform;
  overall: CheckState;
  checks: Check[];
  vcId: string | null;
  txId: string | null;
  issuerDid: string | null;
  issuerName: string;
  issuerJurisdiction: Jurisdiction | null;
  /** Status word for the result card pill (active, revoked, expired, not on record…). */
  status: string | null;
  checkedAt: string;
  ref: string;
  fields: Record<string, unknown>;
}

export const issuerOf = (vc: Record<string, unknown>) =>
  typeof vc.issuer === 'string' ? vc.issuer : ((vc.issuer as { id?: string } | undefined)?.id ?? null);

export function looksLikeVc(v: unknown): v is Record<string, unknown> {
  const o = v as Record<string, unknown>;
  return !!o && typeof o === 'object' && (Array.isArray(o['@context']) || typeof o['@context'] === 'string') && !!o.proof && !!issuerOf(o);
}

/** A VC-JWT / SD-JWT (PILA's compact format): three base64url parts. */
export const looksLikeJwt = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*(~[A-Za-z0-9_~.-]*)?$/.test(v.trim());

/** Keys under which tools commonly wrap a credential (e.g. {"credential": …}, {"vc": "<jwt>"}). */
const WRAPPERS = ['credential', 'verifiableCredential', 'vc', 'jwt', 'document', 'data', 'signedCredential'];

/**
 * W3C VC 2.0 "EnvelopedVerifiableCredential": a signed VC-JWT carried in JSON as a data: URL, e.g.
 * {"@context": [...], "type": "EnvelopedVerifiableCredential", "id": "data:application/vc+jwt,eyJ…"}.
 */
function envelopedJwt(o: Record<string, unknown>): string | null {
  const types = Array.isArray(o.type) ? o.type : [o.type];
  if (!types.includes('EnvelopedVerifiableCredential') || typeof o.id !== 'string') return null;
  const m = /^data:application\/(?:vc\+jwt|vc\+sd-jwt|vc-ld\+jwt|jwt)(?:;[^,]*)?,(.+)$/.exec(o.id.trim());
  return m && looksLikeJwt(m[1]) ? m[1].trim() : null;
}

/** Finds the credential in parsed JSON: the object itself, a JWT string, or either one inside a common wrapper. */
function unwrap(v: unknown, depth = 0): Record<string, unknown> | string | null {
  if (looksLikeVc(v)) return v;
  if (looksLikeJwt(v)) return v.trim();
  if (depth > 2 || !v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const jwt = envelopedJwt(o);
  if (jwt) return jwt;
  for (const k of WRAPPERS) {
    const inner = Array.isArray(o[k]) ? (o[k] as unknown[])[0] : o[k];
    const found = inner === undefined ? null : unwrap(inner, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Why a JSON object is not a signed credential, in plain words. */
function whatIsMissing(v: unknown): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'it is not a credential object';
  const o = v as Record<string, unknown>;
  if (o.header && o.payload && !o.signature) {
    return 'it is a decoded JWT (header and payload only), without the signature that proves it. Upload the original .jwt file (the one-line eyJ… text)';
  }
  if (!o.credentialSubject) {
    const inner = WRAPPERS.map((k) => o[k]).find((x) => x && typeof x === 'object');
    if (inner) return whatIsMissing(Array.isArray(inner) ? inner[0] : inner);
  }
  if (o.credentialSubject && !o.proof) return 'it has no signature (proof); it looks like an unsigned credential. For a PILA eLC, upload the original .jwt file or its signed JSON form (EnvelopedVerifiableCredential)';
  if (!o['@context']) return 'it has no @context';
  if (!issuerOf(o)) return 'it names no issuer';
  if (!o.proof) return 'it has no signature (proof)';
  return 'its structure was not recognised';
}

/** Parses an uploaded file: a JSON credential, a VC-JWT, or either one wrapped in a JSON object. */
export function parseCredentialText(text: string, fileName: string): Record<string, unknown> | string {
  const t = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    if (looksLikeJwt(t)) return t;
    throw new Error(`${fileName} is neither JSON nor a VC-JWT.`);
  }
  const found = unwrap(parsed);
  if (found) return found;
  throw new Error(`${fileName} is not a signed credential: ${whatIsMissing(parsed)}.`);
}

const PILA_LABEL = PORTAL.externalPlatform.name;

/** TOTM issued it if the issuer DID is in the TOTM issuer registry. */
async function totmIssuer(did: string | null): Promise<BankEntry | null> {
  if (!did || did.startsWith('did:nda:')) return null; // did:nda = a PILA/NDAKey identity
  try {
    return (await trustApi.bankByDid(did)).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e; // TOTM API down: do not silently send it to PILA
  }
}

export async function verifyCredential(input: Record<string, unknown> | string): Promise<Verification> {
  if (typeof input === 'string') return verifyPila(input);
  let bank: BankEntry | null;
  try {
    bank = await totmIssuer(issuerOf(input));
  } catch {
    return verifyTotm(input, null); // registry unreachable: the TOTM path reports "could not be checked"
  }
  return bank ? verifyTotm(input, bank) : verifyPila(input);
}

// ---------- TOTM (TrustVC + TOTM verification context) ----------

const STATUS_TEXT: Record<ElcStatus, string> = {
  active: 'Active: issued and still valid',
  suspended: 'Suspended: replaced or withdrawn by the issuer',
  expired: 'Expired: past its expiry date',
  not_found: 'Not on record with the issuer',
};

async function verifyTotm(vc: Record<string, unknown>, issuer: BankEntry | null): Promise<Verification> {
  const issuerDid = issuerOf(vc);
  const vcId = typeof vc.id === 'string' ? vc.id : null;
  const [content, context] = await Promise.all([
    trustApi.verifyContent(vc).then((r) => r, (e: unknown) => e as ApiError),
    vcId && issuerDid ? trustApi.verificationContext(vcId, issuerDid).then((r) => r, (e: unknown) => e as ApiError) : null,
  ]);
  const issuerName = issuer?.name ?? 'the issuer';

  const integrity: Check = { id: 'integrity', title: 'Integrity', question: 'Unchanged since signing?', state: 'error', detail: [] };
  const signer: Check = { id: 'issuer', title: 'Issuer', question: `Signed by ${issuerName}?`, state: 'error', detail: [] };
  if (content instanceof ApiError) {
    integrity.detail = [{ text: `Could not be checked: ${content.message}`, state: 'error' }];
    signer.detail = integrity.detail;
  } else {
    const c = content.data;
    integrity.state = c.integrity.result;
    integrity.detail = [
      { text: 'Document fields locked in a fixed order', state: c.integrity.result === 'error' ? 'error' : 'pass' },
      { text: 'Document fingerprint calculated', state: c.integrity.result === 'error' ? 'error' : 'pass' },
      { text: c.integrity.result === 'pass' ? 'Contents match the signature' : c.integrity.message, state: c.integrity.result },
    ];
    signer.state = c.issuer.result;
    signer.detail = [{ text: c.issuer.message, state: c.issuer.result }];
  }

  const status: Check = { id: 'status', title: 'Status', question: 'Still valid today?', state: 'error', detail: [] };
  const trusted: Check = { id: 'trusted', title: 'Trusted issuer', question: 'Allowed to issue eLCs?', state: 'error', detail: [] };
  let st: ElcStatus | null = null;
  let txId: string | null = content instanceof ApiError ? null : content.data.txId;
  if (!context || context instanceof ApiError) {
    const why = context ? `Could not be checked: ${context.message}` : 'The eLC has no ID or issuer';
    status.detail = [{ text: why, state: 'error' }];
    trusted.detail = status.detail;
  } else {
    const v = context.data.vcs[0];
    st = v.status;
    txId = v.txId ?? txId;
    status.state = v.status === 'active' ? 'pass' : 'fail';
    status.detail = [{ text: STATUS_TEXT[v.status], state: status.state }];
    trusted.state = v.isIssuerTrusted && v.didPublicKey ? 'pass' : 'fail';
    trusted.detail = [{
      text: trusted.state === 'pass'
        ? `${issuerName} is in the TOTM issuer registry and may issue eLCs`
        : 'The issuer is not in the registry, is not active, or may not issue eLCs',
      state: trusted.state,
    }];
  }

  const proof = proofOf(vc);
  const ctxVc = context && !(context instanceof ApiError) ? context.data.vcs[0] : null;
  integrity.facts = [
    ...fact('Proof', proof?.cryptosuite ?? proof?.type),
    ...fact('Signed', proof?.created ? fmtDateTime(proof.created) : null),
    ...fact('Checked by', 'TrustVC (TradeTrust) on the TOTM Trust API'),
  ];
  status.facts = [
    ...fact('Tx ID', txId, { mono: true, copy: true }),
    ...fact('Valid from', vc.validFrom ? fmtDate(String(vc.validFrom)) : null),
    ...fact('Valid until', dateWithDistance(vc.validUntil as string | undefined)),
  ];
  signer.facts = [
    ...fact('Issuer DID', issuerDid, { mono: true, copy: true }),
    ...fact('Signing key', proof?.verificationMethod, { mono: true, copy: true }),
    ...fact('Public key', ctxVc?.didPublicKey ?? issuer?.publicKey, { mono: true, copy: true }),
  ];
  trusted.facts = issuer ? [
    ...fact('Registered name', issuer.name),
    ...fact('Role', issuer.role),
    ...fact('BIC', issuer.bic, { mono: true }),
    ...fact('Registry status', issuer.status),
    ...fact('May issue', issuer.allowedDocs?.length ? issuer.allowedDocs.join(', ') : 'Any document type'),
    ...fact('Registered', issuer.validFrom || issuer.validUntil ? `${issuer.validFrom ? fmtDate(issuer.validFrom) : 'open'} – ${issuer.validUntil ? fmtDate(issuer.validUntil) : 'no end date'}` : null),
    ...fact('Registry', 'TOTM IssuerRegistryV2 (on-chain)'),
  ] : [];
  const checks = [integrity, status, signer, trusted];
  return {
    platform: 'TOTM', overall: overallOf(checks), checks, vcId, txId, issuerDid,
    issuerName: issuer?.name ?? issuerDid ?? '—',
    issuerJurisdiction: jurisdictionFromBic(issuer?.bic),
    status: st,
    checkedAt: new Date().toISOString(),
    ref: refOf(content instanceof ApiError ? content.requestId : content.requestId),
    fields: (vc.credentialSubject ?? {}) as Record<string, unknown>,
  };
}

// ---------- PILA (PILA Go SDK + NDAKey verification context) ----------

/** A resolver or network failure means "could not check", not "bad credential". */
const isNetworkError = (e?: string) => !!e && /HTTP request|dial tcp|timeout|no such host|Forbidden|connection refused|not reachable/i.test(e);

async function verifyPila(input: Record<string, unknown> | string): Promise<Verification> {
  const fallbackIssuer = typeof input === 'string' ? null : issuerOf(input);
  let r: PilaVerifyResponse;
  let requestId: string;
  try {
    ({ data: r, requestId } = await pilaVerify(input));
  } catch (e) {
    const err = e as ApiError;
    const detail = [{ text: `Could not be checked: ${err.message}`, state: 'error' as const }];
    const checks: Check[] = [
      { id: 'integrity', title: 'Integrity', question: 'Unchanged since signing?', state: 'error', detail },
      { id: 'status', title: 'Status', question: 'Still valid today?', state: 'error', detail },
      { id: 'issuer', title: 'Issuer', question: 'Signed by the stated issuer?', state: 'error', detail },
      { id: 'trusted', title: 'Trusted issuer', question: `Trusted by ${PILA_LABEL}?`, state: 'error', detail },
    ];
    if (err.status === 400) checks.forEach((c) => { c.state = 'fail'; c.detail = [{ text: err.message, state: 'fail' }]; });
    return base(checks, input, fallbackIssuer, null, err.requestId, typeof input === 'string' ? {} : (input.credentialSubject ?? {}) as Record<string, unknown>);
  }
  const c = r.checks;
  const nd = r.ndakey;
  const reg = r.issuerRegistry;

  // Integrity: the SDK's signature check.
  const sigState: CheckState = c.signature.passed ? 'pass' : isNetworkError(c.signature.error) ? 'error' : 'fail';
  const integrity: Check = {
    id: 'integrity', title: 'Integrity', question: 'Unchanged since signing?', state: sigState,
    detail: r.format === 'jwt'
      ? [{ text: 'Token decoded', state: 'pass' }, { text: c.signature.passed ? 'Signature matches the contents' : c.signature.error ?? 'Signature does not match', state: sigState }]
      : [
        { text: 'Document fields locked in a fixed order', state: 'pass' },
        { text: 'Document fingerprint calculated', state: 'pass' },
        { text: c.signature.passed ? 'Contents match the signature' : c.signature.error ?? 'Contents changed after signing', state: sigState },
      ],
  };

  // Status: PILA's verification context only. Active passes; expired, revoked or not on record fails; no answer = not checked.
  const ndStatus = nd.called && !nd.error ? nd.status : undefined;
  const NDA_STATUS: Record<string, { text: string; state: CheckState }> = {
    active: { text: `Active on the ${PILA_LABEL} network`, state: 'pass' },
    verified: { text: `Active on the ${PILA_LABEL} network`, state: 'pass' },
    expired: { text: `Expired on the ${PILA_LABEL} network`, state: 'fail' },
    revoked: { text: `Revoked on the ${PILA_LABEL} network`, state: 'fail' },
    not_found: { text: `Not on record with ${PILA_LABEL}: the network has no live status for this eLC`, state: 'fail' },
  };
  const sd = ndStatus
    ? NDA_STATUS[ndStatus] ?? { text: `${PILA_LABEL} network status: ${ndStatus}`, state: 'fail' as CheckState }
    : { text: `Live status not checked: ${nd.error ?? nd.skipped ?? `${PILA_LABEL} verification context not asked`}`, state: 'error' as CheckState };
  const status: Check = { id: 'status', title: 'Status', question: 'Still valid today?', state: sd.state, detail: [sd] };

  // Issuer: was it signed by the issuer it names? The SDK resolves that DID's key and checks the signature with it.
  // (Whether the issuer is registered / trusted is the fourth check.)
  const did = r.issuer ?? fallbackIssuer ?? '';
  const shortDid = did.length > 30 ? `${did.slice(0, 22)}…${did.slice(-6)}` : did;
  let issState: CheckState;
  let issText: string;
  if (!c.issuer.passed) {
    issState = isNetworkError(c.issuer.error) ? 'error' : 'fail';
    issText = issState === 'error' ? `Could not look up the key of ${shortDid}: ${c.issuer.error}` : `The stated issuer ${shortDid} could not be found`;
  } else if (c.signature.passed) {
    issState = 'pass';
    issText = `Signature belongs to the stated issuer ${shortDid}`;
  } else {
    issState = sigState === 'error' ? 'error' : 'fail';
    issText = `Signature does not match the key of the stated issuer ${shortDid}`;
  }
  const issuer: Check = {
    id: 'issuer', title: 'Issuer', question: 'Signed by the stated issuer?', state: issState,
    detail: [{ text: issText, state: issState }],
  };

  // Trusted issuer: only NDAKey's isIssuerTrusted counts; the registry alone can only say "not registered".
  let tState: CheckState;
  let tText: string;
  if (nd.called && nd.isIssuerTrusted !== undefined) {
    tState = nd.isIssuerTrusted ? 'pass' : 'fail';
    const as = reg?.registered ? ` · registered as ${reg.type ?? 'unknown'}` : '';
    tText = nd.isIssuerTrusted ? `Trusted by NDAKey (${PILA_LABEL})${as}` : `Not trusted by NDAKey${as}`;
  } else if (reg?.checked && !reg.registered) {
    tState = 'fail';
    tText = `Issuer is not registered with NDAKey (${PILA_LABEL})`;
  } else {
    tState = 'error';
    tText = `Trust not confirmed${reg?.registered ? ` (registered with NDAKey as ${reg.type ?? 'unknown'})` : ''}: ${nd.error ?? nd.skipped ?? reg?.error ?? 'NDAKey not asked'}`;
  }
  const trusted: Check = { id: 'trusted', title: 'Trusted issuer', question: `Trusted by ${PILA_LABEL}?`, state: tState, detail: [{ text: tText, state: tState }] };

  const pill = ndStatus === 'not_found' ? 'not on record' : ndStatus === 'verified' ? 'active' : ndStatus ?? null;
  const proof = proofOf(input);
  integrity.facts = [
    ...fact('Format', r.format === 'jwt' ? 'VC-JWT' : 'JSON-LD (Data Integrity)'),
    ...fact('Proof', proof?.cryptosuite ?? proof?.type),
    ...fact('Signed', proof?.created ? fmtDateTime(proof.created) : null),
    ...fact('Checked by', r.sdk),
  ];
  status.facts = [
    ...fact('Valid from', r.validFrom ? fmtDate(r.validFrom) : null),
    ...fact('Valid until', dateWithDistance(r.validUntil) ?? 'No expiry declared'),
    ...fact('PILA status', nd.status?.replace('_', ' ')),
    ...fact('NDAKey request', nd.requestId, { mono: true }),
  ];
  issuer.facts = [
    ...fact('Issuer DID', did, { mono: true, copy: true }),
    ...fact('Key found in', r.issuerSource),
    ...fact('Public key', nd.didPublicKey, { mono: true, copy: true }),
  ];
  trusted.facts = [
    ...fact('NDAKey registry', reg ? (reg.checked ? (reg.registered ? `Registered as ${reg.type ?? 'unknown'}` : 'Not registered') : reg.error ?? 'Not checked') : null),
    ...fact('Trusted (NDAKey)', nd.isIssuerTrusted === undefined ? null : nd.isIssuerTrusted ? 'Yes' : 'No'),
    ...fact('Credential type', r.types?.join(', ')),
  ];
  return base([integrity, status, issuer, trusted], input, r.issuer ?? fallbackIssuer, r.id ?? null, requestId, r.subject ?? {}, pill);
}

function base(checks: Check[], input: Record<string, unknown> | string, issuerDid: string | null, vcId: string | null,
  requestId: string, fields: Record<string, unknown>, status: string | null = null): Verification {
  return {
    platform: 'PILA', overall: overallOf(checks), checks,
    vcId: vcId ?? (typeof input === 'string' ? null : (input.id as string | undefined) ?? null),
    txId: null, issuerDid,
    issuerName: issuerDid ? `${issuerDid.slice(0, 18)}…${issuerDid.slice(-6)}` : '—',
    issuerJurisdiction: JURISDICTIONS[PORTAL.externalPlatform.jurisdiction],
    status, checkedAt: new Date().toISOString(), ref: refOf(requestId), fields,
  };
}

const overallOf = (checks: Check[]): CheckState =>
  checks.some((c) => c.state === 'fail') ? 'fail' : checks.some((c) => c.state === 'error') ? 'error' : 'pass';

const refOf = (requestId: string) => `VR-${requestId.slice(0, 8).toUpperCase()}`;

// ---------- facts ----------

const fact = (label: string, value: unknown, opts: Partial<Fact> = {}): Fact[] =>
  value == null || value === '' ? [] : [{ label, value: String(value), ...opts }];

/** "31 Dec 2026 (in 50 days)" / "(ended 3 days ago)". */
function dateWithDistance(iso?: string | null) {
  if (!iso) return null;
  const n = daysUntil(iso);
  return `${fmtDate(iso)} (${n < 0 ? `ended ${-n} day${n === -1 ? '' : 's'} ago` : n === 0 ? 'ends today' : `in ${n} day${n === 1 ? '' : 's'}`})`;
}

function proofOf(input: Record<string, unknown> | string) {
  if (typeof input === 'string') return null;
  const p = (Array.isArray(input.proof) ? input.proof[0] : input.proof) as Record<string, string> | undefined;
  return p ?? null;
}
