// Vercel function: POST /api/pila/context → PILA's verification context API (issuer trust + live status), with the
// NDAKey verifier key added here. Signed-in portal users only. Env: PILA_PARTNER_API_KEY, optional PILA_NDAKEY_URL.
import { authConfig, readSession } from '../server/auth.js';
import { handlePilaContext } from '../server/pilaContext.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!readSession(authConfig(process.env), req.headers.cookie)) {
    res.status(401).json({ code: 'E_SESSION', error: 'Sign in to the portal first' });
    return;
  }
  await handlePilaContext(req, res, process.env);
}
