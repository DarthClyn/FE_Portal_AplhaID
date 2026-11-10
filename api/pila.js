// Vercel function: forwards /api/pila/{verify|health} to the pila-verifier service (PILA SDK + NDAKey), for signed-in
// portal users only. Env: PILA_VERIFIER_URL (where the service runs, e.g. a Railway service), PILA_VERIFIER_TOKEN.
import { authConfig, readSession } from '../server/auth.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!readSession(authConfig(process.env), req.headers.cookie)) {
    res.status(401).json({ code: 'E_SESSION', error: 'Sign in to the portal first' });
    return;
  }
  const base = (process.env.PILA_VERIFIER_URL || '').replace(/\/$/, '');
  if (!base) {
    res.status(503).json({ code: 'E503', error: 'PILA verification is not configured (PILA_VERIFIER_URL)' });
    return;
  }
  const path = String(new URL(req.url, 'http://local').searchParams.get('path') || '');
  if (!['verify', 'health'].includes(path)) {
    res.status(404).json({ code: 'E404', error: 'No such endpoint' });
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = { 'content-type': 'application/json' };
  if (req.headers['x-request-id']) headers['x-request-id'] = req.headers['x-request-id'];
  if (process.env.PILA_VERIFIER_TOKEN) headers['x-verifier-token'] = process.env.PILA_VERIFIER_TOKEN;
  let upstream;
  try {
    upstream = await fetch(`${base}/${path}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    res.status(502).json({ code: 'E502', error: `PILA verifier not reachable: ${e.message}` });
    return;
  }
  res.status(upstream.status);
  res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
  res.send(Buffer.from(await upstream.arrayBuffer()));
}
