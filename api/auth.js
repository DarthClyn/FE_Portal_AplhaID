// Vercel function: /api/auth/{login|me|logout} (rewritten to /api/auth?action=…). See server/auth.js.
import { handleAuth } from '../server/auth.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const action = new URL(req.url, 'http://local').searchParams.get('action') || '';
  await handleAuth(req, res, action, process.env);
}
