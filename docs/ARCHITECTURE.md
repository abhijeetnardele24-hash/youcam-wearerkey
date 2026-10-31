# WearerKey Technical Architecture

## 1. System Topology

WearerKey is designed as a secure, role-separated collaboration protocol that orchestrates Perfect Corp's YouCam AI Clothes V4 API while preserving total visual privacy for the wearer.

```text
[Wearer Browser]                  [WearerKey Server]                 [Helper Browser]
       │                                  │                                  │
       │ 1. POST /api/sessions            │                                  │
       ├─────────────────────────────────>│                                  │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤                                  │
       │ (returns wearer bootstrap)       │                                  │
       │                                  │                                  │
       │ 2. PUT /api/wearer/session       │                                  │
       │    (source photo + consent gate) │                                  │
       ├─────────────────────────────────>│ (in-memory Sharp EXIF stripping) │
       │                                  │                                  │
       │ 3. POST /api/wearer/helper-link  │                                  │
       ├─────────────────────────────────>│                                  │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤ (mints scoped helper bootstrap) │
       │                                  │                                  │
       │ 4. Shares Helper Link offline    │                                  │
       │────────────────────────────────────────────────────────────────────>│
       │                                  │                                  │
       │ 5. POST /api/auth/bootstrap      │ 5b. POST /api/auth/bootstrap     │
       │    (exchanges single-use code    │     (exchanges single-use code   │
       │     for HttpOnly cookie)         │      for HttpOnly cookie)        │
       │                                  │                                  │
       │                                  │ 6. GET /api/helper/session       │
       │                                  │<─────────────────────────────────┤
       │                                  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
       │                                  │ (permitted categories only;      │
       │                                  │  ZERO wearer photos in DTO)      │
       │                                  │                                  │
       │                                  │ 7. POST /api/helper/proposals    │
       │                                  │<─────────────────────────────────┤
       │                                  │ (uploads garment image & link)   │
       │                                  │                                  │
       │                                  │ 8. POST .../generate             │
       │                                  │<─────────────────────────────────┤
       │                                  │                                  │
       │                                  │──[ YouCam S2S Task ]──┐          │
       │                                  │  - POST /file         │          │
       │                                  │  - POST /cloth-v4     │          │
       │                                  │  - GET status (poll)  │          │
       │                                  │  - DELETE /file       │          │
       │                                  │<──────────────────────┘          │
       │                                  │                                  │
       │ 9. GET .../proposals/:id/result  │                                  │
       ├─────────────────────────────────>│                                  │
       │<─────────────────────────────────┤                                  │
       │ (proxies try-on render directly) │                                  │
       │                                  │                                  │
       │ 10. POST .../decision            │                                  │
       │    (APPROVE/MAYBE/PASS + note)   │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  │ 11. GET /api/helper/session      │
       │                                  │<─────────────────────────────────┤
       │                                  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
       │                                  │ (receives verdict & safe note)   │
```

---

## 2. Capability-Based Authorization Invariant

Rather than relying on persistent user accounts, passwords, or shared room identifiers, WearerKey uses single-use bootstrap links and role-isolated HttpOnly session cookies:

1. **Bootstrap Minting:** When a session is created, single-use bootstrap codes are minted.
2. **Redemption:** The browser exchanges the code via `POST /api/auth/bootstrap` for role-isolated HttpOnly cookies (`wearerkey_session_wearer` or `wearerkey_session_helper`).
3. **Storage & Verification:** Session token hashes are stored in the database (`wearerSessionTokenHash` and `helperSessionTokenHash`) and verified in constant time (`crypto.timingSafeEqual`).
4. **Role Isolation:**
   - Handlers registered under `/api/wearer/*` enforce `requireRole('wearer')`.
   - Handlers registered under `/api/helper/*` enforce `requireRole('helper')`.
   - Helper credentials presented to wearer routes return `HTTP 403 FORBIDDEN`.
   - Revoked sessions reject subsequent role requests with `HTTP 410 SESSION_REVOKED`.

---

## 3. Cryptographic Storage & Sanitization

1. **AES-256-GCM Encryption:** Remote task IDs, temporary provider file IDs, and upstream result URLs are encrypted at rest using AES-256-GCM before being persisted in the database.
2. **Server-Side In-Memory Sharp Sanitization:**
   - EXIF/GPS sanitization occurs server-side in memory before provider transmission.
   - Raw uploaded photos are processed exclusively in memory via Sharp.
   - All EXIF metadata (GPS location coordinates, camera models, creation timestamps) is stripped.
   - Images are validated for dimensional integrity (maximum 4096px, minimum 256px, maximum 10MB) and re-encoded.
   - Raw bytes are never written to unencrypted disk or permanent database tables.
3. **HMAC-SHA256 Deletion Receipts:**
   - WearerKey produces an application-signed HMAC-SHA256 receipt upon session completion or revocation.
   - The HMAC signature verifies the authenticity and integrity of the application-issued receipt ledger.
   - Deletion statuses record genuine responses from YouCam's official APIs (`POST /s2s/v2.0/task/delete`, `DELETE /s2s/v2.0/file/{fileId}`).

---

## 4. State Machines

### Session State Lifecycle
```text
[DRAFT] ──> [ACTIVE] ──> [REVOKED] ──> [PURGED]
              │
              └──> [EXPIRED]
```

### Proposal State Lifecycle
```text
[CREATED] ──> [READY] ──> [SUBMITTED] ──> [PROCESSING] ──> [SUCCEEDED] ──> [REVIEWED]
                 │                                                │
                 └──> [GATE_BLOCKED]                              └──> [FAILED]
```

---

## 5. Delivery Model

The application compiles into a single, self-contained deployment unit:
- Fastify backend serves `/api/*` routes.
- Built React 18 SPA frontend is served statically from `apps/web/dist` with SPA history fallback.
- Compatible with single-container Docker deployment on port 3000.

---

## 6. Disclaimers

- **Visual Appearance Preview:** Visual try-on provides an aesthetic coordination and drape simulation using YouCam AI Clothes V4; it is not a certified sizing, tailoring, stretch, or physical fabric guarantee.
- **Accessibility:** Tested views have verified 0 Axe-core violations across Desktop Chrome and Mobile 390px viewports.
