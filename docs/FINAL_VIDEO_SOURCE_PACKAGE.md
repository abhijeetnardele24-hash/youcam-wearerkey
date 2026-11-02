# WearerKey — Final Video Recording Source Package

This document specifies the exact, reproducible recording timeline, browser states, URLs, data inputs, real UI button labels, and narration cues for Codex or human recording operators to produce the authoritative 2:20–2:40 demo video for the **YouCam API Skin AI & eCommerce VTO Hackathon 2026**.

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
  - Wearer Room: `http://localhost:3000/wearer#bootstrap=<token>`
  - Helper Room: `http://localhost:3000/helper#bootstrap=<token>`
  - Receipt Verification: `http://localhost:3000/receipt`

---

## 2. Mutually Exclusive Recording Scripts

Choose exactly one script based on whether a rotated, live `YOUCAM_API_KEY` is present.

---

### SCRIPT A — Live YouCam API Execution (When `YOUCAM_API_KEY` is Configured)

Use this script when a valid YouCam API key is active in the environment and `scripts/live-youcam-smoke.ts` confirms live provider connectivity (`LIVE_YOUCAM`).

#### Segment A1: The Problem & The Privacy-First Promise (0:00 – 0:14)
- **URL:** `http://localhost:3000/`
- **Action:**
  - Cursor scrolls gently down the Home page showcasing the hero tagline: *"Shop together without sharing the wearer's photo."*
  - Camera zooms smoothly on the **VisibilityRail** diagram illustrating strict role separation: Wearer (private silhouette & fitted mirror) vs Helper (garment curator).
- **Narration:**
  > "Shopping online with friends or stylists is great, but virtual try-on forces an unacceptable trade-off: to see how clothes look, you have to text unedited body photos across messaging apps. WearerKey solves this with a role-separated privacy boundary powered by Perfect Corp's YouCam AI Clothes V4 API."

#### Segment A2: Wearer Mints Consent Pass (0:14 – 0:32)
- **URL:** `http://localhost:3000/create`
- **Action:**
  - Click **"Create Pass"** in the navigation bar.
  - Select permitted categories: **"Tops & Shirts"**, **"Outerwear"**, **"Full Outfits & Dresses"**.
  - Keep Proposal Cap at default 5, Expiration at 24 hours.
  - Click **"Use Sample Silhouette"** (or upload reference photo).
  - Click **"Create Pass & Open Wearer Control Room"**.
  - Wearer Control Room opens. Point out the **Consent Seal** with active policy constraints.
  - Click **"Generate Helper Link"**, then click **"Copy"**.
- **Narration:**
  > "The wearer begins by creating an immutable Consent Pass defining allowed clothing categories like Tops & Shirts and Full Outfits with a proposal limit. Their reference photo is sanitized in-memory with camera metadata stripped. The wearer then copies a single-use helper link."

#### Segment A3: Helper Curates Without Photo Access (0:32 – 0:54)
- **URL:** Helper link copied in Segment A2 (`http://localhost:3000/helper#bootstrap=...` in an incognito window or split view)
- **Action:**
  - Helper opens the bootstrap link. The single-use token redeems and establishes an isolated helper cookie.
  - Highlight the banner: **"Wearer Photo: Protected (Never Shared)"**.
  - Select Category: **"Outerwear"**.
  - Enter Title: *"Tailored Camel Wool Overcoat"*, Brand: *"Atelier Nordic"*, Price: *$245*.
  - Click **"Use Sample Garment"**.
  - Click **"Propose to Wearer"**.
  - Proposal card appears in helper queue. Click **"Request Virtual Try-On"**.
  - Helper sees status change to *"Processing..."* and then *"succeeded"*. DevTools inspection confirms **0 wearer image bytes** and **0 result stream URLs** are returned to the helper.
- **Narration:**
  > "When the shopping companion opens the helper link, they can see approved categories, but the wearer's photo is completely absent. The helper proposes an overcoat and requests virtual try-on. The server talks to YouCam API on their behalf, but the helper never receives the rendered pixels."

#### Segment A4: Live YouCam AI Clothes V4 Private Mirror (0:54 – 1:26)
- **URL:** `http://localhost:3000/wearer` (Wearer Room window)
- **Action:**
  - Real-time SSE delivers the fitted proposal into the Wearer Control Room.
  - In the Private Mirror, highlight the green live badge: **"Live YouCam Clothes V4 Result"**.
  - Cycle through the view modes:
    - **"3-Stage Journey"**: `1. Private Source Silhouette → 2. Garment Candidate → 3. Neural Fitted Result`.
    - **"Try-On"**: Full zoom on garment drape, lapel alignment, and texture realism.
    - **"Side-by-Side"**: Direct comparison between reference silhouette and try-on fit.
  - Demonstrate privacy control: Click initial button **"Show My Photo"** in the room controls to reveal the reference photo, then click **"Hide My Photo (All Views)"** to show that wearer source photos can be shielded even in the private room. Click **"Show My Photo"** to unshield.
  - Point out the mandatory disclaimer footer: *"Visual Appearance Preview Only"*.
- **Narration:**
  > "In the wearer's private mirror, the live YouCam AI Clothes V4 render appears instantly. The neural engine accurately fits the coat to posture and drape. The wearer can inspect the three-stage transformation or shield their reference photo with Show My Photo and Hide My Photo. Only the wearer sees this fitting."

#### Segment A5: Private Decision & Helper Sync (1:26 – 1:48)
- **URL:** Wearer Room & Helper Room side-by-side
- **Action:**
  - On the Decision Slip, select **"Approve"**.
  - Add safe note: *"Drape and length look great, ordering size M"*.
  - Click **"Send Verdict"**.
  - Switch to Helper window: the helper's card instantly updates to **"Approved by Wearer"** with the note, but **no photo is ever revealed**.
- **Narration:**
  > "The wearer selects Approve, adds a sizing note, and clicks Send Verdict. The companion immediately sees the verdict, allowing them to finalize the cart together while the wearer's photos remain strictly private."

#### Segment A6: Session Revoke, Provider File Purge & Audit Receipt (1:48 – 2:10)
- **URL:** Wearer Room -> `/receipt`
- **Action:**
  - In the Wearer Room, click **"Revoke Pass & Purge Data"**.
  - Confirm modal: Click **"Confirm Revoke & Purge"**.
  - System immediately triggers fail-closed deletion against YouCam S2S endpoints (`POST /s2s/v2.0/task/delete`, `DELETE /s2s/v2.0/file/{id}`) and purges in-memory buffers.
  - The page navigates to `/receipt`.
  - Highlight **"Application-Signed Deletion Status Assertion"**:
    - `overall_deletion_status: CONFIRMED`
    - `provider_tasks_deleted: 1 / 1`
    - `remote_files_deleted: 1 / 1`
    - `in_memory_buffers_purged: true` (rendered as `CONFIRMED`)
    - `local_access_revoked: true` (rendered as `REVOKED`)
  - Show the HMAC-SHA256 tamper-evident ledger signature.
- **Narration:**
  > "When shopping concludes, the wearer revokes the session. WearerKey purges RAM buffers and executes task and file deletions against upstream YouCam servers, generating an HMAC-SHA256 signed audit receipt verifying the ledger state."

#### Segment A7: 30-Second Judge Tour & Closing (2:10 – 2:35)
- **URL:** `http://localhost:3000/judge`
- **Action:**
  - Open `/judge` and click **"Launch Interactive Split-Screen"**.
  - Showcase the simultaneous Wearer and Helper perspectives operating side-by-side.
  - Point to the **Judge Evidence & Privacy Boundary Inspection Panel**:
    - Live provider badge, consent policies, zero-byte helper payloads, and Sharp metadata sanitization.
  - Mention verified test coverage: 109 automated tests (97 Vitest unit/integration tests + 12 Playwright browser/accessibility tests) passing with 0 Axe violations.
- **Narration:**
  > "Judges can test the entire workflow in under 30 seconds at `/judge`. Backed by 109 automated tests, zero secret leakage, and truthfulness in every claim. WearerKey brings private, collaborative virtual try-on to eCommerce. Thank you."

---

### SCRIPT B — Fixture-Safe Fallback (Current Baseline Truthful Demonstration)

Use this script when recording without a newly rotated live API key, operating under deterministic `DEMO_FIXTURE` mode.

#### Segment B1: The Problem & The Privacy-First Promise (0:00 – 0:14)
- **URL:** `http://localhost:3000/`
- **Action:**
  - Cursor scrolls gently down the Home page showcasing the tagline: *"Shop together without sharing the wearer's photo."*
  - Highlight the **VisibilityRail** diagram illustrating strict role separation between Wearer and Helper.
- **Narration:**
  > "Collaborative shopping is fun, but virtual try-on forces shoppers to text unedited body photos across messaging apps. WearerKey solves this with a role-separated privacy architecture designed around Perfect Corp's YouCam AI Clothes V4 API."

#### Segment B2: Wearer Mints Consent Pass (0:14 – 0:32)
- **URL:** `http://localhost:3000/create`
- **Action:**
  - Click **"Create Pass"** in the navigation bar.
  - Select permitted categories using exact labels: **"Tops & Shirts"**, **"Outerwear"**, **"Full Outfits & Dresses"** (or use category presets).
  - Observe default Proposal Cap at **5** (or adjust). Click **"Use Sample Silhouette"**.
  - Click **"Create Pass & Open Wearer Control Room"**.
  - In the Wearer Room, show the active **Consent Seal**. Click **"Generate Helper Link"** -> **"Copy"**.
- **Narration:**
  > "The wearer sets up an immutable Consent Pass with permitted categories like Tops & Shirts and Full Outfits, a proposal limit of five, and their reference silhouette. Camera EXIF and GPS metadata are stripped in memory. The wearer copies a single-use helper link."

#### Segment B3: Helper Curates Without Photo Access (0:32 – 0:54)
- **URL:** `http://localhost:3000/helper#bootstrap=...` (or use Split View in `/judge`)
- **Action:**
  - Helper opens the single-use bootstrap link.
  - Highlight the banner: **"Wearer Photo: Protected (Never Shared)"**.
  - Select Category: **"Outerwear"**. Title: *"Tailored Camel Wool Overcoat"*.
  - Click **"Use Sample Garment"** -> **"Propose to Wearer"**.
  - Click **"Request Virtual Try-On"**.
  - Show that helper status reflects *"succeeded"*, but DevTools inspection proves **0 wearer image bytes** and **0 result stream URLs** ever reach the helper.
- **Narration:**
  > "On the helper's screen, approved categories are visible, but the wearer's photo is strictly inaccessible. The helper proposes an overcoat and triggers try-on. The server orchestrates the fitting boundary without exposing private pixels to the helper."

#### Segment B4: Private Mirror & Truthful Mode Badge (0:54 – 1:26)
- **URL:** `http://localhost:3000/wearer` (Wearer Room)
- **Action:**
  - Proposal arrives in the Wearer Control Room.
  - In the Private Mirror, highlight the neutral stone badge: **"Deterministic Demo Fixture"** (matching the `/judge` stone `DEMO_FIXTURE` badge).
  - Read the transparent note: *"Deterministic offline workflow fixture demonstrating the integration boundary without claiming live synthesis."*
  - Demonstrate view modes: **"3-Stage Journey"**, **"Try-On"**, **"Side-by-Side"**.
  - Demonstrate privacy control: Observe that reference photo is hidden initially. Click initial button **"Show My Photo"** in the room controls to reveal it, then click **"Hide My Photo (All Views)"** to show that wearer source photos can be shielded across every panel.
  - Show the disclaimer footer: *"Visual Appearance Preview Only"*.
- **Narration:**
  > "In the wearer's private mirror, the proposal appears. WearerKey's UI transparently labels offline test samples with a stone Demo Fixture badge rather than fabricating live neural execution. Shoppers can inspect the fit stages or toggle reference photo shielding with Show My Photo and Hide My Photo. Only the wearer sees this fitting."

#### Segment B5: Private Decision & Helper Verdict Sync (1:26 – 1:48)
- **URL:** Wearer Room & Helper Room side-by-side
- **Action:**
  - On the Decision Slip, select **"Approve"**.
  - Add safe note: *"Drape and length look great, ordering size M"*.
  - Click **"Send Verdict"**.
  - Switch to Helper window: card instantly reflects **"Approved by Wearer"** with the note, with **zero image transmission**.
- **Narration:**
  > "The wearer selects Approve and clicks Send Verdict. The companion immediately sees the decision to finish cart checkout, while the wearer retains 100% custody of their private images."

#### Segment B6: Session Revocation & Simulation Audit Receipt (1:48 – 2:10)
- **URL:** Wearer Room -> `/receipt`
- **Action:**
  - In Wearer Room, click **"Revoke Pass & Purge Data"**.
  - Click **"Confirm Revoke & Purge"**.
  - In fixture mode, the application purges local in-memory buffers (`in_memory_buffers_purged: true`) and revokes local credentials (`local_access_revoked: true`). Because no live YouCam requests were dispatched, upstream provider cleanup is simulated by the fixture provider (`deletion_verification_mode: "SIMULATED"`). Never claim requests reached YouCam or upstream deletion occurred without a live receipt.
  - The UI navigates to `/receipt`, presenting an **Application-Signed Simulation Ledger**:
    - `deletion_verification_mode: "SIMULATED"`
    - `in_memory_buffers_purged: true` (rendered as `CONFIRMED` in UI)
    - `local_access_revoked: true` (rendered as `REVOKED` in UI)
    - `overall_deletion_status: "CONFIRMED"` (local simulation)
    - `provider_tasks_deleted: 1 / 1` (simulated fixture task)
    - `remote_files_deleted: 1 / 1` (simulated fixture file)
  - Point out that this receipt is an application-signed simulation ledger with an HMAC-SHA256 signature establishing local ledger integrity, explicitly noting that live upstream YouCam deletion was not claimed.
- **Narration:**
  > "When shopping concludes, the wearer revokes the session. WearerKey purges RAM buffers, revokes access tokens, and signs an HMAC-SHA256 audit receipt. In fixture mode, this is transparently recorded as an application-signed simulation ledger with deletion verification marked as SIMULATED, never falsely claiming live requests reached YouCam."

#### Segment B7: 30-Second Judge Tour & Closing (2:10 – 2:35)
- **URL:** `http://localhost:3000/judge`
- **Action:**
  - Open `/judge` and click **"Launch Interactive Split-Screen"**.
  - Show both perspectives operating side-by-side.
  - Point to the stone **DEMO_FIXTURE** badge on `/judge`.
  - Review the **Judge Evidence & Privacy Boundary Inspection Panel** confirming truthful provider mode labeling, zero helper data exposure, and in-memory metadata stripping.
  - Highlight the full automated test suite: 109 passing automated tests (97 Vitest unit/integration tests + 12 Playwright browser/accessibility tests across desktop and mobile viewports with 0 Axe violations).
- **Narration:**
  > "Judges can test the full two-party flow in under 30 seconds at `/judge`, displaying the truthful stone DEMO_FIXTURE badge. Backed by 109 automated tests, zero secret leakage, and truthfulness in every claim. WearerKey unlocks private collaborative virtual try-on. Thank you."

---

## 3. Strict Truthfulness Boundaries for Narration

### Mandatory Prohibitions (Never Utter in Demo)
- **DO NOT** claim "cryptographic proof of physical provider deletion" (say *"application-signed audit receipt recording provider responses"*).
- **DO NOT** claim "ironclad zero leakage" or "zero knowledge" (say *"server-enforced role separation with zero helper image bytes"*).
- **DO NOT** claim sizing accuracy, perfect physical tailoring, or conversion metrics.
- **DO NOT** claim live neural generation when running bundled synthetic SVG/PNG demo fixtures.

### Allowed Truthful Claims
- *"Powered by Perfect Corp's YouCam AI Clothes V4 API integration architecture."*
- *"Server-enforced role separation where helper endpoints return 0 image bytes."*
- *"HMAC-SHA256 signed audit receipt documenting local buffer zeroization and provider deletion calls."*
- *"Visual appearance preview simulation only."*
