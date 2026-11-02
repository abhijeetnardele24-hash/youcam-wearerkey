# WearerKey — Final Video Recording Source Package

This document specifies the exact, reproducible recording timeline, browser states, URLs, data inputs, and narration cues for Codex or human recording operators to produce the authoritative 2:20–2:40 demo video for the YouCam API Skin AI & eCommerce VTO Hackathon 2026.

---

## 1. Recording Setup & Clean Reset Command

### Resetting State Before Recording
To guarantee identical pre-seeded test data and clear browser cookies:
```bash
# 1. Start the local server
pnpm start

# 2. Reset / Pre-seed the demo session via API endpoint
curl -X POST http://localhost:3000/api/judge/seed \
  -H "Content-Type: application/json" \
  -d '{}'
```
Or open `http://localhost:3000/judge` and click **"Reset Session"**.

### Browser Configuration
- **Resolution:** 1920x1080 (1080p, 60fps)
- **Browser:** Google Chrome (Clean profile, bookmarks bar hidden)
- **Primary URLs:**
  - Landing: `http://localhost:3000/`
  - Create Pass: `http://localhost:3000/create`
  - Judge Tour: `http://localhost:3000/judge`
  - Wearer Room: `http://localhost:3000/wearer`
  - Helper Room: `http://localhost:3000/helper`
  - Receipt Verification: `http://localhost:3000/receipt`

---

## 2. Timed 2:30 Recording Sequence

### Segment 1: The Problem & Memorable Promise (0:00 – 0:12)
- **URL:** `http://localhost:3000/`
- **Action:**
  - Cursor scrolls gently down the Home page showcasing the tagline: *"Shop together without sharing the wearer's photo."*
  - Camera highlights the **VisibilityRail** diagram illustrating the separation between Wearer (private pixels) and Helper (curator).
- **Narration:**
  > "Shopping online with friends is fun, but virtual try-on forces an impossible choice: to see if an outfit works, you have to text your unedited body photo to another person. WearerKey changes this forever."

### Segment 2: Wearer Consent Pass (0:12 – 0:28)
- **URL:** `http://localhost:3000/create`
- **Action:**
  - Click **"Create Try-On Pass"** from the home navigation.
  - Select permitted categories: **"Outerwear"**, **"Upper Body"**, **"Full Body"**.
  - Keep Proposal Cap at 3, Expiration at 24 hours.
  - Click **"Use Sample Silhouette"** to load the consented reference image.
  - Click **"Create Secure Pass"**.
  - Show the newly minted **Consent Seal** in the Wearer Room and click **"Generate Helper Link"** -> **"Copy"**.
- **Narration:**
  > "The wearer begins by defining an immutable Consent Pass: approved clothing categories, a proposal limit, and their private reference photo. Camera EXIF and GPS data are stripped in memory. The wearer then copies a single-use helper link."

### Segment 3: Helper Proposal Without Photo Access (0:28 – 0:48)
- **URL:** `http://localhost:3000/helper` (open in adjacent incognito tab or use Split View in `/judge`)
- **Action:**
  - Navigate to the Helper Room.
  - Highlight the prominent banner: **"Wearer Photo: Protected (Never Shared)"**.
  - Select category: **"Outerwear"**.
  - Enter Title: *"Camel Wool Peacoat"*, Brand: *"COS"*.
  - Click **"Use Sample Garment"** (or upload garment photo).
  - Click **"Submit Garment Proposal"**.
  - Briefly open DevTools Network tab showing 0 wearer photo bytes and 0 stream URLs in the helper response.
- **Narration:**
  > "On the helper's screen, permitted categories are visible, but the wearer's photo is completely absent. The helper proposes a tailored peacoat. Even inspecting network payloads reveals zero wearer image bytes. The boundary is strictly enforced by the server."

### Segment 4: YouCam AI Clothes V4 Neural Fitting (0:48 – 1:20)
- **URL:** `http://localhost:3000/wearer`
- **Action:**
  - Switch back to the Wearer Room.
  - The new peacoat proposal arrives via real-time SSE stream.
  - In the Private Mirror, click **"Request Virtual Try-On"** (or observe the rendered result).
  - Switch view modes:
    - Click **"3-Stage Journey"** to show: `1. Wearer Reference → 2. Garment Candidate → 3. YouCam VTO Result`.
    - Click **"Try-On"** and zoom in on the neural garment drape and texture folds.
  - Highlight the badge: **"Powered by YouCam AI Clothes V4"** and the appearance preview disclaimer.
- **Narration:**
  > "In the wearer's private mirror, the proposal appears instantly. The server orchestrates Perfect Corp's YouCam AI Clothes V4 API, transferring the garment onto the wearer's silhouette while adapting to posture and lighting. Only the wearer sees this rendered fit."

### Segment 5: Private Wearer Decision & Helper Verdict (1:20 – 1:42)
- **URL:** `http://localhost:3000/wearer` & `http://localhost:3000/helper`
- **Action:**
  - On the Wearer Decision Slip, select **"Approve"**.
  - Add safe note: *"Drape looks great, ordering medium"*.
  - Click **"Record Verdict"**.
  - Switch to Helper window: the helper's card instantly updates to **"Approved by Wearer"** with the note, but **no image is ever transmitted**.
- **Narration:**
  > "The wearer casts an Approve verdict with a note. The companion receives the decision immediately so they can finish shopping together, while the wearer retains full custody of their photos."

### Segment 6: Session Revoke, Provider Cleanup & Audit Receipt (1:42 – 2:03)
- **URL:** `http://localhost:3000/wearer` -> `/receipt`
- **Action:**
  - In the Wearer Room, click **"Revoke Pass"**.
  - Confirm the revocation modal: *"Confirm Revoke & Purge"*.
  - Show the generated **Tamper-Evident Deletion Receipt v2.0**:
    - `overall_deletion_status: CONFIRMED`
    - Provider task deletion confirmed (`POST /s2s/v2.0/task/delete`)
    - Remote file deletion confirmed (`DELETE /s2s/v2.0/file/{id}`)
    - Memory buffers purged
  - Click **"Verify Receipt Authenticity"** showing the HMAC-SHA256 constant-time cryptographic check passing with a green checkmark.
- **Narration:**
  > "When shopping concludes, the wearer revokes the session with one click. WearerKey purges in-memory buffers and executes deletion requests against upstream YouCam tasks and files, generating an HMAC-SHA256 signed audit receipt establishing ledger authenticity."

### Segment 7: Architecture & 30-Second Judge Tour (2:03 – 2:25)
- **URL:** `http://localhost:3000/judge`
- **Action:**
  - Click **"Launch Interactive Split-Screen"** on the Judge Tour page.
  - Display both Wearer and Helper perspectives operating side-by-side.
  - Highlight the **Judge Evidence & Privacy Boundary Inspection Panel**:
    - Provider Mode: `DEMO_FIXTURE` (truthfully labeled, stone badge) / `LIVE_YOUCAM`
    - Helper DTO Data Exposure: 0 Image Bytes Exposed
    - Server-Side Sanitization: In-Memory Sharp Pipeline
- **Narration:**
  > "Judges can test the entire two-party flow in under 30 seconds at `/judge`. The evidence panel exposes the provider mode, consent gates, zero-byte helper payloads, and commit-bound receipts."

### Segment 8: Potential Impact & Closing (2:25 – 2:40)
- **URL:** `http://localhost:3000/`
- **Action:**
  - Return to the clean landing page.
  - Quick flash of the verified test suite: 90 tests passing (80 Vitest + 10 Playwright e2e/Axe).
  - Title card: **WearerKey — Private Collaborative Virtual Try-On**.
- **Narration:**
  > "WearerKey unlocks collaborative eCommerce for privacy-conscious shoppers, modest fashion, and remote stylists. Backed by 90 automated tests, zero secret leakage, and truthfulness in every claim. Thank you."

---

## 3. Truthful Claim Boundaries for Narration
- **ALLOWED:**
  - "Powered by Perfect Corp's YouCam AI Clothes V4 API."
  - "Server-enforced privacy boundary: helper API endpoints return 0 wearer image bytes."
  - "HMAC-SHA256 application ledger authenticity recording provider deletion responses."
  - "Visual appearance preview simulation only."
- **STRICTLY PROHIBITED (DO NOT STATE):**
  - Do NOT say "cryptographic proof of physical provider deletion" (say "application-signed audit receipt recording provider responses").
  - Do NOT say "ironclad zero leakage" (say "server-enforced role separation").
  - Do NOT claim sizing accuracy or conversion metrics.
