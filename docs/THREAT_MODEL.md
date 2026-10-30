# WearerKey — Formal Threat Model & Security Architecture

**Document Version:** 1.0  
**Target Architecture:** WearerKey Private Collaborative Virtual Try-On  
**Engine:** YouCam AI Clothes V4 Server-to-Server API  
**Last Evaluated:** October 2026  

---

## 1. System Overview & Core Trust Boundaries

WearerKey is an evidence-first, role-separated privacy relay protocol designed to allow a **Wearer** and a **Helper** to shop together collaboratively without requiring the wearer to send their personal reference photograph or try-on renderings to the helper.

```
+---------------------------------------------------------------------------------------+
|                                    TRUST BOUNDARY 1                                   |
|                                    (Wearer Domain)                                    |
|                                                                                       |
|  [ Wearer Client / Browser ]                                                          |
|    - Uploads source reference photo                                                   |
|    - Configures immutable Consent Seal (categories, max proposals, expiry)            |
|    - Receives & views try-on renderings inside Private Mirror                         |
|    - Records Approve / Maybe / Pass verdicts                                          |
|    - Holds Wearer Capability Token (exchanged via bootstrap for HttpOnly cookie)       |
+---------------------------------------------------------------------------------------+
                                           |
                                           | HTTPS / TLS 1.3
                                           v
+---------------------------------------------------------------------------------------+
|                                    TRUST BOUNDARY 2                                   |
|                              (WearerKey Relay Server)                                 |
|                                                                                       |
|  - Fastify API + Security Headers (CSP, Frame-Options, Referrer-Policy)               |
|  - In-Memory Sharp Sanitizer (EXIF, GPS, camera metadata stripping)                  |
|  - Token Hash Storage (SHA-256 only, constant-time timingSafeEqual verification)      |
|  - Strict Role-Enforced Route Handlers & Zod DTO Serialization                        |
|  - AES-256-GCM Encryption of Provider IDs and URLs at Rest                           |
|  - Ephemeral Memory Store (Volatile image buffers purged on session close/revocation) |
|  - Deletion State Machine & Tamper-Evident HMAC-SHA256 Signed Receipts                |
|  - Pino Logger Automatic Redaction (Authorization, Cookie, Set-Cookie, tokens)        |
+---------------------------------------------------------------------------------------+
         |                                                                     ^
         | HTTPS / S2S                                                         | HTTPS
         v                                                                     |
+-------------------------------------+             +-----------------------------------+
|          TRUST BOUNDARY 3           |             |         TRUST BOUNDARY 4          |
|    (Upstream Perfect Corp YouCam)   |             |          (Helper Domain)          |
|                                     |             |                                   |
|  - YouCam Clothes V4 Engine         |             |  [ Helper Client / Browser ]      |
|  - Presigned S2S File Upload        |             |    - Proposes garments            |
|  - Async Task Processing            |             |    - Sees permitted categories    |
|  - Remote Task/File Deletion API    |             |    - Sees wearer verdicts & notes |
|  - Fail-closed error mapping        |             |    - ZERO ACCESS to wearer photo  |
+-------------------------------------+             |    - ZERO ACCESS to try-on render |
                                                    +-----------------------------------+
```

---

## 2. Assets to Protect

| Asset ID | Asset Name | Sensitivity | Protection Requirement |
| :--- | :--- | :--- | :--- |
| **A-1** | Wearer Source Photo | High (Biometric / Private) | Never exposed to helper, third parties, or logged to disk/logs. EXIF metadata stripped before provider transmission. |
| **A-2** | Virtual Try-On Render | High (Personal Likeness) | Delivered strictly to wearer's private mirror. Never exposed to helper API responses or helper DOM. |
| **A-3** | Capability Tokens | High (Authorization Credential) | Raw tokens never persisted; stored solely as SHA-256 digests. Cleared from URL bar via single-use bootstrap into HttpOnly cookie. |
| **A-4** | Provider Task IDs & URLs | Medium (Infrastructure Meta) | Encrypted at rest via AES-256-GCM. Never logged or leaked to clients. |
| **A-5** | Audit & Deletion Receipts | Medium (Accountability Ledger) | Signed with HMAC-SHA256 to ensure tamper-evidence and unforgeable purge proofs. |

---

## 3. Threat Actors & Threat Scenarios

### T-1: Curious or Compromised Shopping Companion (Helper)
- **Threat:** Helper inspects network traffic, DOM, browser storage, or crafts custom HTTP requests to view the wearer's photo or try-on result.
- **Mitigation:**
  - Route handlers under `/api/helper/*` return strictly typed `HelperSessionDTO` and `HelperProposalDTO` where `result_stream_url`, `source_image_url`, and wearer photos are completely omitted from the schema.
  - Helper attempts to request `/api/wearer/session/source` or `/api/wearer/proposals/:id/result` fail with HTTP 403 Forbidden via role-based middleware (`requireRole('wearer')`).
  - Unit and integration tests verify that helper endpoints fail closed and never serialize image data.

### T-2: Token Interception via Browser History or Referrer Headers
- **Threat:** Long-lived capability tokens stored in URL query parameters or paths leak via browser history, proxy logs, or HTTP `Referer` headers.
- **Mitigation:**
  - Capability links support URL fragments (`/wearer#token=...`) which are never transmitted over the network in HTTP request lines.
  - A dedicated single-use bootstrap endpoint (`POST /api/auth/bootstrap`) exchanges the capability token for a secure `HttpOnly`, `SameSite=Lax` cookie (`wearerkey_session`).
  - Immediate `window.history.replaceState` sanitizes the browser address bar to `/wearer` or `/helper`.
  - HTTP header `Referrer-Policy: strict-origin-when-cross-origin` prevents leakage to external links.

### T-3: Log Sniffing & Secret Exposure
- **Threat:** API keys, session tokens, or bearer credentials are logged in server stdout/stderr or monitoring systems.
- **Mitigation:**
  - Pino logger is configured with strict redaction paths: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `req.headers["x-capability-token"]`, and `req.query.token`.
  - Automated `scripts/security-scan.ts` scans all git-tracked files for potential API keys or tokens.

### T-4: Metadata & Geolocation Leakage via Source Image
- **Threat:** Uploaded camera images contain embedded EXIF metadata (GPS coordinates, camera serial numbers, capture timestamp).
- **Mitigation:**
  - Every uploaded image passes through `sanitizeAndValidateImage()` using Sharp before being saved or uploaded to YouCam.
  - Re-encoded cleanly to PNG/JPEG, stripping all EXIF, IPTC, and XMP metadata chunks in memory.

### T-5: Incomplete Remote Provider Deletion & Zombie Data
- **Threat:** System claims data is deleted when upstream provider deletion failed or timed out.
- **Mitigation:**
  - Multi-stage deletion state machine (`NOT_REQUESTED`, `REQUESTED`, `CONFIRMED`, `PARTIAL_FAILURE`, `FAILED`).
  - Independent status tracking for tasks, garment files, and source photo files.
  - **Inviolate Invariant:** `purged_at` strictly remains `null` if any provider deletion is unconfirmed or fails.
  - Wearer can initiate bounded retries via `POST /api/wearer/session/retry-purge`.

### T-6: Receipt Forgery or Tampering
- **Threat:** An adversary modifies deletion counts, commit SHA, or purge timestamps in an audit receipt.
- **Mitigation:**
  - Receipts are serialized via deterministic alphabetical key canonicalization (`canonicalizeJson`) and signed with HMAC-SHA256 (`signReceiptPayload`).
  - Public verification endpoint `POST /api/receipts/verify` performs constant-time cryptographic verification (`crypto.timingSafeEqual`).

---

## 4. Honest Architectural Disclaimers & Residual Risks

1. **Not End-to-End Homomorphic Encryption:** WearerKey does not perform homomorphic computation. The wearer's image is held in volatile memory on the WearerKey server and transmitted via TLS to Perfect Corp's YouCam API to perform the neural garment drape. WearerKey minimizes this risk through ephemeral in-memory storage, immediate post-try-on remote purge, and strict role segregation.
2. **Physical Shoulder Surfing:** If the wearer physically shows their phone or laptop screen to the shopping companion in person, software boundaries cannot prevent visual observation.
3. **Upstream Provider Trust:** WearerKey relies on Perfect Corp's server-to-server API to faithfully delete files and tasks upon receiving the official deletion requests (`DELETE /s2s/v2.0/file/{fileId}` and `POST /s2s/v2.0/task/delete`).

