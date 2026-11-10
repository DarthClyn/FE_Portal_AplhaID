// Vercel function: forwards /api/trust/* to the TOTM Trust API with the admin key added server side.
// Env: TRUST_API_URL, ADMIN_API_KEY. The browser never sees the key. Only signed-in portal users get through;
// their name is sent as X-Actor for the audit log.
import { authConfig, readSession } from '../server/auth.js';

export const config = { api: { bodyParser: false } };

const PASS_REQ = ['content-type', 'x-request-id'];
const PASS_RES = ['content-type', 'content-disposition', 'x-request-id', 'x-file-sha256'];

export default async function handler(req, res) {
  const base = (process.env.TRUST_API_URL || '').replace(/\/$/, '');
  if (!base || !process.env.ADMIN_API_KEY) {
    res.status(503).json({ code: 'E503', error: 'Portal proxy is not configured (TRUST_API_URL, ADMIN_API_KEY)' });
    return;
  }
  const session = readSession(authConfig(process.env), req.headers.cookie);
  if (!session) {
    res.status(401).json({ code: 'E_SESSION', error: 'Sign in to the portal first' });
    return;
  }
  const url = new URL(req.url, 'http://local');
  const path = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
  url.searchParams.delete('path');
  if (!/^[A-Za-z0-9._~%:/-]*$/.test(path) || path.includes('..')) {
    res.status(400).json({ code: 'E400', error: 'Bad path' });
    return;
  }
  const headers = { 'x-admin-key': process.env.ADMIN_API_KEY, 'x-actor': session.name };
  for (const h of PASS_REQ) if (req.headers[h]) headers[h] = req.headers[h];
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const qs = url.searchParams.toString();
  const upstream = await fetch(`${base}/api/v1/${path}${qs ? `?${qs}` : ''}`, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
  res.status(upstream.status);
  for (const h of PASS_RES) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.send(Buffer.from(await upstream.arrayBuffer()));
}
