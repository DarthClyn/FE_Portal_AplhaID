# pila-verifier

Verifies credentials **not issued by TOTM** (PILA-issued eLCs and other PILA credentials) for the Bank Alpha portal.
A verification-only cut of the Orchestration Layer's `pila-bridge`: it runs **PILA's official Go SDK**
([go-credential-sdk](https://github.com/pilacorp/go-credential-sdk) v1.13.1) and calls **NDAKey's verification context API**.
Nothing is reimplemented.

```bash
# needs Go 1.24.6+ (https://go.dev/dl/)
cd pila-verifier
go mod tidy      # first run only: downloads the SDK
go run .         # listens on 127.0.0.1:4100
```

| Endpoint | Body | Returns |
| --- | --- | --- |
| `GET /health` | – | resolver, NDAKey URL, whether the verifier key is set |
| `POST /verify` | `{ "credential": <JSON object or JWT string> }` | `checks.issuer / signature / expiration / revocation` (SDK) + `ndakey` (verification context) + `subject` |

How each check runs:

- **signature** – `cred.Verify()` in PILA's SDK (JSON-LD Data Integrity, VC-JWT ES256K/ES256, SD-JWT).
- **issuer** – resolves the issuer DID: `did:nda` via NDAKey's registry (`GET /dids/{did}`), then PILA's public resolver;
  `did:key` locally.
- **expiration / revocation** – SDK options `WithCheckExpiration()` / `WithCheckRevocation()` (when `credentialStatus` exists).
- **NDAKey verification context** – `POST /vp/verification-context` with `X-Api-Key: PILA_PARTNER_API_KEY`: issuer trusted
  (`isIssuerTrusted`) and live status (`active`, `revoked`, `expired`, `not_found`). Needs the credential ID, issuer and
  holder DID (`credentialSubject.id`).

Settings are read from the portal's `.env` (`PILA_*` lines only; the shell wins):

| Variable | Default | |
| --- | --- | --- |
| `PILA_PARTNER_API_KEY` | – | NDAKey verifier key (SECRET). Without it there is no trust/status answer. |
| `PILA_NDAKEY_URL` | `https://api-beta.ndakey.vn/service/api/v1` | `off` skips NDAKey |
| `PILA_DID_RESOLVER_URL` | `https://api.ndadid.vn/api/v1/did` | PILA's public DID resolver |
| `PILA_VERIFIER_TOKEN` | – | Shared secret; set it when hosted (the portal proxy sends it) |
| `PORT` | `4100` | |

The portal reaches it through its server-side proxy (`/api/pila/*` → `PILA_VERIFIER_URL`), for signed-in users only.
Hosting: deploy this folder as its own Railway service (it detects `go.mod`), set the variables above and
`PILA_VERIFIER_TOKEN`, and point the portal's `PILA_VERIFIER_URL` at it.

Not included from the bridge: issuing, demo identities, DIDComm and the demo bank's self-resolved DID document. A
`did:nda` issuer must therefore be known to NDAKey or PILA's resolver.
