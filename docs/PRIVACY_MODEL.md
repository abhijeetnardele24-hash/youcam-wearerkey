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
| **Direct API ID Guessing** | Helper attempts to request `/api/wearer/proposals/:id/result`. | Endpoint requires authenticated wearer session cookie. Hashed token is validated against the session's `wearerSessionTokenHash`. Presentation of a helper token returns `HTTP 403 FORBIDDEN`. |
| **Token Brute-Force / Timing Attacks** | Attacker probes capability tokens with differing character prefixes. | Tokens contain 256 bits of entropy (32 random bytes). Hashes are compared in constant time with `crypto.timingSafeEqual`. |
| **EXIF Metadata Leakage** | Uploaded reference photo contains GPS coordinates, home address, or camera identifiers. | EXIF/GPS sanitization occurs server-side in memory before provider transmission. Sharp processes every image buffer in memory before forwarding to YouCam's File API, stripping all EXIF and color-profile metadata tags. |
| **Cloud Provider Data Retention** | YouCam servers retain reference images indefinitely. | WearerKey tracks all provider file and task IDs and dispatches explicit deletion requests (`DELETE /s2s/v2.0/file/{fileId}` and `POST /s2s/v2.0/task/delete`) upon session completion or revocation. Recorded provider responses are captured in an HMAC-SHA256 signed audit receipt. |
| **Database Compromise** | An attacker gains read access to the SQL database. | Raw photos are never stored in the database. Only metadata and AES-256-GCM encrypted provider IDs are persisted. |

---

## 3. Scoped Capability Tokens

```text
Wearer Token (32 bytes hex)  ──SHA-256──>  wearerSessionTokenHash  ──Stored in DB──> Role = "wearer"
Helper Token (32 bytes hex)  ──SHA-256──>  helperSessionTokenHash  ──Stored in DB──> Role = "helper"
```

Because capability tokens are unguessable, independent, and revocable:
- The Wearer can instantly revoke shopping access by clicking **"Revoke Pass & Purge Session"**.
- Revocation immediately invalidates both active tokens (moving hashes to revoked records for 410 detection) and purges in-memory session records.
- Neither user needs to create an account, enter passwords, or link external social profiles.

---

## 4. Machine-Verifiable Deletion Receipt (v2.0)

Every session revocation or completion generates a verifiable deletion receipt containing:
- `session_id`: Unique UUID
- `evaluated_commit_sha`: Git commit under which the session ran
- `provider_tasks_total`: Total remote tasks processed
- `provider_tasks_deleted`: Remote task files confirmed deleted via `POST /s2s/v2.0/task/delete`
- `remote_files_deleted`: Remote source and garment files deleted via `DELETE /s2s/v2.0/file/{fileId}`
- `overall_deletion_status`: `CONFIRMED`, `PARTIAL_FAILURE`, or `FAILED`
- `evidence_authority`: `"WEARERKEY_APPLICATION_SIGNED_ASSERTION"`
- `receipt_hmac`: HMAC-SHA256 cryptographic signature

> **Cryptographic Scope Disclosure:** The HMAC signature proves the authenticity and integrity of the application-issued receipt ledger. It certifies that the recorded deletion actions and statuses were issued by the WearerKey server, but does not independently prove third-party provider physical disk wiping beyond the recorded responses returned by the YouCam API.

---

## 5. Visual Try-On & Accessibility Disclosures

- **Visual Appearance Preview Only:** Virtual try-on simulates clothing drape and aesthetic coordination using YouCam AI Clothes V4. It is an aesthetic decision aid, not a certified sizing, tailoring, stretch, or physical fabric guarantee.
- **Accessibility:** Axe-core accessibility automated testing confirmed 0 violations across tested states and viewports (Home, Create, Judge Tour, Wearer Room, Helper Room).
