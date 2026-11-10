// Portal login, server side only (Vite dev middleware and Vercel functions share this file).
// Credentials come from the environment: PORTAL_USERNAME, PORTAL_PASSWORD, optional PORTAL_DISPLAY_NAME and
// PORTAL_SESSION_SECRET. A successful login sets a signed, HttpOnly cookie; nothing is stored server side.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'alpha_session';
const HOURS = 8;          // normal session (cookie also ends when the browser closes)
const REMEMBER_DAYS = 30; // "Keep me signed in"

export function authConfig(env) {
  const username = env.PORTAL_USERNAME || '';
  const password = env.PORTAL_PASSWORD || '';
  // Without an explicit secret, derive one from values that are already secret (changing the password logs everyone out).
  const secret = env.PORTAL_SESSION_SECRET || createHash('sha256').update(`portal:${username}:${password}:${env.ADMIN_API_KEY || ''}`).digest('hex');
  return { username, password, name: env.PORTAL_DISPLAY_NAME || username, secret, configured: !!(username && password) };
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (cfg, data) => createHmac('sha256', cfg.secret).update(data).digest('base64url');
const same = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
};

export function createSession(cfg, remember = false) {
  const ttl = remember ? REMEMBER_DAYS * 86400_000 : HOURS * 3600_000;
  const data = b64(JSON.stringify({ u: cfg.username, n: cfg.name, exp: Date.now() + ttl }));
  return `${data}.${sign(cfg, data)}`;
}

/** The signed-in user from the request's cookie, or null. */
export function readSession(cfg, cookieHeader) {
  if (!cfg.configured) return null;
  const raw = String(cookieHeader || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [data, mac] = raw.split('.');
  if (!data || !mac || !same(mac, sign(cfg, data))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (s.u !== cfg.username || !(s.exp > Date.now())) return null;
    return { username: s.u, name: s.n };
  } catch {
    return null;
  }
}

const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || !!req.socket?.encrypted;
/** maxAge null = session cookie (gone when the browser closes). */
const cookie = (req, value, maxAge) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge == null ? '' : `; Max-Age=${maxAge}`}${isHttps(req) ? '; Secure' : ''}`;

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 10_000) break; }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

/** /api/auth/login (POST {username, password, remember?}), /api/auth/me (GET), /api/auth/logout (POST). */
export async function handleAuth(req, res, action, env) {
  const cfg = authConfig(env);
  if (action === 'me') {
    const s = readSession(cfg, req.headers.cookie);
    return s ? send(res, 200, { user: s }) : send(res, 401, { code: 'E_SESSION', error: 'Not signed in' });
  }
  if (action === 'logout' && req.method === 'POST') {
    return send(res, 200, { ok: true }, { 'set-cookie': cookie(req, '', 0) });
  }
  if (action === 'login' && req.method === 'POST') {
    if (!cfg.configured) return send(res, 503, { code: 'E503', error: 'Login is not configured on the server (PORTAL_USERNAME, PORTAL_PASSWORD).' });
    const { username, password, remember } = await readBody(req);
    // Compare both, always, so the response time does not reveal which one was wrong.
    const userOk = same(typeof username === 'string' ? username.trim() : '', cfg.username);
    const passOk = same(typeof password === 'string' ? password : '', cfg.password);
    const ok = userOk && passOk;
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600)); // slows down guessing
      return send(res, 401, { code: 'E_LOGIN', error: 'Wrong username or password.' });
    }
    const keep = remember === true;
    return send(res, 200, { user: { username: cfg.username, name: cfg.name } }, { 'set-cookie': cookie(req, createSession(cfg, keep), keep ? REMEMBER_DAYS * 86400 : null) });
  }
  return send(res, 404, { code: 'E404', error: 'No such endpoint' });
}
