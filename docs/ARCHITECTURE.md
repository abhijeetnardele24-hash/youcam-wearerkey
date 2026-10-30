# WearerKey Technical Architecture

## 1. System Topology

WearerKey is designed as a secure, role-separated collaboration protocol that orchestrates Perfect Corp's YouCam AI Clothes V4 API while preserving total visual privacy for the wearer.

```text
[Wearer Browser]                  [WearerKey Server]                 [Helper Browser]
       │                                  │                                  │
       │ 1. POST /api/sessions            │                                  │
       ├─────────────────────────────────>│                                  │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤                                  │
       │ (returns wearer capability)      │                                  │
       │                                  │                                  │
       │ 2. PUT /api/wearer/session       │                                  │
       │    (source photo + consent gate) │                                  │
       ├─────────────────────────────────>│ (in-memory Sharp EXIF stripping) │
       │                                  │                                  │
       │ 3. POST /api/wearer/helper-link  │                                  │
       ├─────────────────────────────────>│                                  │
       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤ (mints scoped helper token)     │
       │                                  │                                  │
       │ 4. Shares Helper Link offline    │                                  │
       │────────────────────────────────────────────────────────────────────>│
       │                                  │                                  │
       │                                  │ 5. GET /api/helper/session       │
       │                                  │<─────────────────────────────────┤
       │                                  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
       │                                  │ (permitted categories only;      │
       │                                  │  ZERO wearer photos in DTO)      │
       │                                  │                                  │
       │                                  │ 6. POST /api/helper/proposals    │
       │                                  │<─────────────────────────────────┤
       │                                  │ (uploads garment image & link)   │
       │                                  │                                  │
       │                                  │ 7. POST .../generate             │
       │                                  │<─────────────────────────────────┤
       │                                  │                                  │
       │                                  │──[ YouCam S2S Task ]──┐          │
       │                                  │  - POST /file         │          │
       │                                  │  - POST /cloth-v4     │          │
       │                                  │  - GET status (poll)  │          │
       │                                  │  - DELETE /file       │          │
       │                                  │<──────────────────────┘          │
       │                                  │                                  │
       │ 8. GET .../proposals/:id/result  │                                  │
       ├─────────────────────────────────>│                                  │
       │<─────────────────────────────────┤                                  │
       │ (proxies try-on render directly) │                                  │
       │                                  │                                  │
       │ 9. POST .../decision             │                                  │
       │    (APPROVE/MAYBE/PASS + note)   │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  │ 10. GET /api/helper/session      │
       │                                  │<─────────────────────────────────┤
       │                                  │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
       │                                  │ (receives verdict & safe note)   │
```

---

## 2. Capability-Based Authorization Invariant

Rather than relying on persistent user accounts, session cookies, or shared room identifiers, WearerKey uses cryptographically isolated capability tokens:

1. **Generation:** When a session is created, two random 32-byte tokens are minted using `crypto.randomBytes(32).toString('hex')`.
2. **Storage:** Only the SHA-256 hash of each token is stored in the database (`wearerTokenHash` and `helperTokenHash`). The plain token exists solely in the URL fragment/bearer header of the authorized client.
3. **Verification:** Incoming bearer tokens are hashed with SHA-256 and compared against stored hashes using `crypto.timingSafeEqual` to prevent timing-attack side channels.
4. **Role Isolation:**
   - Handlers registered under `/api/wearer/*` enforce `requireRole('wearer')`.
   - Handlers registered under `/api/helper/*` enforce `requireRole('helper')`.
   - A helper token presented to a wearer route produces an immediate `HTTP 403 FORBIDDEN`.

---

## 3. Cryptographic Storage & Sanitization

1. **AES-256-GCM Encryption:** Remote task IDs, temporary provider file IDs, and upstream result URLs are encrypted at rest using AES-256-GCM before being persisted in the metadata database.
2. **Sharp In-Memory Sanitization:**
   - Raw uploaded photos are processed exclusively in memory.
   - All EXIF metadata (GPS location coordinates, camera models, dates) is stripped.
   - Images are validated for dimensional integrity (maximum 4096px, minimum 256px, maximum 10MB) and re-encoded to standard JPEG format.
   - Raw bytes are never written to disk or permanent database tables.

---

## 4. State Machines

### Session State Lifecycle
```text
[DRAFT] ──> [ACTIVE] ──> [COMPLETED] ──> [PURGED]
              │
              ├──> [EXPIRED]
              │
              └──> [REVOKED] ──> [PURGED]
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
