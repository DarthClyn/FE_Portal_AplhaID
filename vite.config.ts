import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { authConfig, handleAuth, readSession } from './server/auth.js';
import { handlePilaContext } from './server/pilaContext.js';

// Local dev: /api/auth/* signs users in (credentials from .env), /api/trust/* is proxied to the TOTM Trust API
// with the admin key added here, server side and for signed-in users only. PILA verification is a Trust API route
// too (/api/trust/pila/verify, PILA's SDK); /api/pila/context calls PILA's verification context API with the NDAKey
// key. Neither the keys nor the credentials reach the browser bundle (no VITE_ prefix).
function portalAuth(env: Record<string, string>): Plugin {
  return {
    name: 'portal-auth',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/api/auth/')) {
          void handleAuth(req, res, url.slice('/api/auth/'.length).split('?')[0], env);
          return;
        }
        if (url.startsWith('/api/trust') || url.startsWith('/api/pila/')) {
          const session = readSession(authConfig(env), req.headers.cookie);
          if (!session) {
            res.statusCode = 401;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ code: 'E_SESSION', error: 'Sign in to the portal first' }));
            return;
          }
          delete req.headers.cookie; // the Trust API does not need the portal cookie
          req.headers['x-actor'] = session.name;
          if (url.split('?')[0] === '/api/pila/context') { void handlePilaContext(req, res, env); return; }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = (env.TRUST_API_URL || 'https://totmregistryapis-production.up.railway.app').replace(/\/$/, '');
  return {
    plugins: [react(), portalAuth(env)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      proxy: {
        '/api/trust': {
          target,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/trust/, '/api/v1'),
          headers: (env.ADMIN_API_KEY ? { 'X-Admin-Key': env.ADMIN_API_KEY } : {}) as Record<string, string>,
        },
      },
    },
  };
});
