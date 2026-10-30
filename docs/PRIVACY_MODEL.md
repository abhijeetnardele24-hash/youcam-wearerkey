# WearerKey Privacy & Threat Model

## 1. Core Privacy Thesis

WearerKey enforces a strict architectural invariant:

> **The shopping companion (Helper) must never receive, inspect, or intercept the Wearer's private reference photo or the generated virtual try-on render.**

The wearer wants collaborative fashion styling and advice without having to expose unedited body photos across messaging apps, email, or unencrypted web links.

---

## 2. Threat Vector Analysis

| Threat Vector | Potential Vulnerability | WearerKey Server-Side Countermeasure |
|---|---|---|
| **DOM Inspection / Network Sniffing** | Helper opens DevTools to inspect image tags or fetch requests. | Helper route handlers completely omit source and result image URLs from all DTO schemas. There are zero image elements containing wearer pixels in the helper DOM. |
| **Direct API ID Guessing** | Helper attempts to request `/api/wearer/proposals/:id/result`. | Endpoint requires `Bearer <wearer_token>`. Hashed token is validated against the session's `wearerTokenHash`. Presentation of a helper token returns `HTTP 403 FORBIDDEN`. |
| **Token Brute-Force / Timing Attacks** | Attacker probes capability tokens with differing character prefixes. | Tokens contain 256 bits of entropy (32 random bytes). Hashes are compared in constant time with `crypto.timingSafeEqual`. |
| **EXIF Metadata Leakage** | Uploaded reference photo contains GPS coordinates, home address, or camera identifiers. | Sharp processes every image in memory before provider transmission, stripping all EXIF and color-profile metadata tags. |
| **Cloud Provider Data Retention** | YouCam servers retain reference images indefinitely. | WearerKey tracks all provider file IDs and dispatches immediate `DELETE /s2s/v2.0/file/:id` requests upon task completion, outputting a signed audit receipt. |
| **Database Compromise** | An attacker gains read access to the SQL database. | Raw photos are never stored in the database. Only metadata and AES-256-GCM encrypted provider IDs are persisted. |

---

## 3. Scoped Capability Tokens

```text
Wearer Token (32 bytes hex)  ──SHA-256──>  wearerTokenHash  ──Stored in DB──> Role = "wearer"
Helper Token (32 bytes hex)  ──SHA-256──>  helperTokenHash  ──Stored in DB──> Role = "helper"
```

Because capability tokens are unguessable, independent, and revocable:
- The Wearer can instantly revoke shopping access by clicking **"Revoke Pass & Purge Session"**.
- Revocation immediately invalidates both tokens and deletes in-memory session records.
- Neither user needs to create an account, enter passwords, or link external social profiles.

---

## 4. Machine-Verifiable Deletion Receipt

Every session revocation or completion generates a verifiable deletion receipt containing:
- `sessionId`: Unique UUID
- `evaluated_commit_sha`: Git commit under which the session ran
- `provider_task_count`: Total tasks processed
- `provider_tasks_deleted`: Remote task files confirmed deleted
- `status`: `PURGED` or `PURGE_PARTIAL`
- `evidence_authority`: Cryptographic signature
