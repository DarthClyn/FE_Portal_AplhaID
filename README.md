# Bank Alpha portal (frontend)

Trade finance portal for Bank Alpha: verify eLCs, issue eLCs, track issued eLCs, read the audit log and receive files
in the Alpha ID Inbox. React 18 + Vite + TypeScript. All data comes from the TOTM Trust API.

## Run locally

```bash
cp .env.example .env      # set ADMIN_API_KEY, PORTAL_USERNAME, PORTAL_PASSWORD (and TRUST_API_URL if not production)
npm install
npm run dev               # portal on http://localhost:5173
```

`npm run build` type-checks and builds to `dist/`.

## Login

The sign-in screen (`/login`) asks for a username and password. They are checked **server side only** against
`PORTAL_USERNAME` / `PORTAL_PASSWORD` (`server/auth.js`, used by the dev server and by the Vercel function
`api/auth.js`); they are never in the browser bundle. A correct login sets a signed, HttpOnly cookie: a browser-session cookie valid for 8 hours, or 30 days with "Keep me signed in"
(`PORTAL_SESSION_SECRET` signs it). Every page needs a session, and the API proxy refuses calls without one.
`PORTAL_DISPLAY_NAME` is the name shown in the portal and written to the audit log.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TRUST_API_URL` | yes | TOTM Trust API base, without `/api/v1` |
| `ADMIN_API_KEY` | yes | Admin key, added by the proxy |
| `PORTAL_USERNAME` | yes | Login username |
| `PORTAL_PASSWORD` | yes | Login password |
| `PORTAL_DISPLAY_NAME` | no | Name in the portal and audit log (default: the username) |
| `PORTAL_SESSION_SECRET` | no | Signs the session cookie (default: derived from the other secrets) |

## How it talks to the API

The browser calls `/api/trust/*`. A proxy forwards that to `TRUST_API_URL/api/v1/*` and adds the admin key server side,
so the key is never in the browser bundle:

- local: the Vite dev proxy (`vite.config.ts`)
- Vercel: the function `api/trust.js` (+ rewrites in `vercel.json`). Set `TRUST_API_URL` and `ADMIN_API_KEY` in the
  Vercel project. Never prefix the key with `VITE_`.

Every call carries `X-Request-Id` (correlation ID) and `X-Actor` (the operator name, shown in the audit log).

## Pages (`src/pages/`, one folder each)

| Route | Page | API |
| --- | --- | --- |
| `/login` | Sign in (user ID + password from the environment) | portal server only |
| `/verify` | Verify eLC: 4 checks (integrity, status, issuer, trusted issuer); TOTM-issued → TOTM, others → PILA | TOTM: `GET /dids/{did}`, `POST /vc/verify`, `POST /vp/verification-context` · PILA: `POST /pila/verify` |
| `/overview` | Overview: all issued eLCs, counts, search, filters, date range, CSV | `GET /admin/vcs` |
| `/overview/:vcId` | eLC detail: record, activity, read-only details, suspend | `GET /admin/vcs/{id}`, `GET /admin/audit`, `POST /admin/vcs/{id}/suspend` |
| `/issue` | Issue eLC: MT700 form, import JSON, drafts, attachments, PDF copy, sign | `POST /admin/elc/issue`, `GET /banks/{bic}` |
| `/inbox` | Alpha ID Inbox: files from PILA, download, verify, mark read | `GET /totm/inbox`, `GET /totm/inbox/{id}`, `POST …/ack` |
| `/audit` | Audit log: filters, problems, details, CSV | `GET /admin/audit` |

Drafts (Issue eLC → Save draft / Open draft) are kept in this browser's localStorage only, for 30 days, and are
removed once the eLC is issued. Nothing about a draft is sent to the server.

The API stores IDs and status only (no eLC content). eLC details are shown for eLCs issued in this browser session, or
after you open the signed eLC file on its detail page.

## Verifying credentials not issued by TOTM (PILA)

The Verify page asks the TOTM issuer registry about the credential's issuer (`GET /dids/{did}`). A TOTM bank's
credential is checked by the TOTM Trust API. Anything else (a `did:nda` issuer, a VC-JWT `.jwt` file, an issuer
unknown to TOTM) goes to **PILA**, in two parts:

- **Integrity + issuer signature**: PILA's official Go SDK on the TOTM Trust API, `POST /api/v1/pila/verify`
  (browser → `/api/trust/pila/verify`, admin key added by the proxy).
- **Trusted issuer + live status**: PILA's own verification context API, NDAKey `POST /vp/verification-context`
  (browser → `/api/pila/context`, NDAKey key added server side by `server/pilaContext.js`; `api/pila.js` on Vercel).

The result shows "via PILA" and the same four checks as a TOTM eLC.

| Variable (portal `.env` / Vercel) | Purpose |
| --- | --- |
| `PILA_PARTNER_API_KEY` | NDAKey verifier key for the verification context (SECRET, server side only) |
| `PILA_NDAKEY_URL` | PILA verification context base (default `https://elc-beta.ndakey.vn/api/v1`, the eLC pilot environment) |

## Layout

```
src/config/portal.ts        bank, operator, partner banks, jurisdictions (the only place country names appear), features
src/pages/<page>/           page component(s) + its CSS
src/shared/components/      UI building blocks (one folder each), exported from index.ts
src/shared/services/        API client (http, trustApi), eLC model + validation, verification, audit mapping,
                            formatting, files, PDF copy, session memory, useAsync
src/styles/                 design tokens and base styles
src/pages/login/            sign-in screen
server/auth.js              login check and session cookie (server side, shared by dev server and Vercel)
api/auth.js, api/trust.js   Vercel functions: login, and the API proxy
api/pila.js, server/pilaContext.js  PILA's verification context API (issuer trust, status), key server side
```
