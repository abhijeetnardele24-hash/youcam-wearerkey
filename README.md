# WearerKey — Private Collaborative Virtual Try-On

[![CI Suite](https://github.com/abhijeetnardele24-hash/youcam-wearerkey/actions/workflows/ci.yml/badge.svg)](https://github.com/abhijeetnardele24-hash/youcam-wearerkey/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Engine: YouCam Clothes V4](https://img.shields.io/badge/Engine-YouCam%20AI%20Clothes%20V4-1F624F.svg)](https://www.perfectcorp.com)

> **Shop together without sharing the wearer's photo.**  
> An evidence-backed privacy protocol orchestrating Perfect Corp's **YouCam AI Clothes V4** API for collaborative fashion curation without surrendering personal reference images.

---

## 1. Executive Summary & Problem Thesis

Collaborative shopping is one of the most natural social behaviors in fashion: shoppers ask partners, friends, or stylists for advice before purchasing. However, contemporary virtual try-on (VTO) tools force an uncomfortable trade-off: **to get feedback on how clothes fit you, you must send your full-body photo or screenshots of yourself to another person.**

For millions of people, this is a privacy barrier due to body sensitivity, personal boundaries, religious practices, or workplace confidentiality.

**WearerKey solves this with a role-separated private collaboration protocol:**
1. **The Wearer** defines an immutable **Consent Seal** (permitted garment categories, candidate cap, expiration) and uploads their private reference photo.
2. **The Wearer** shares a cryptographically scoped **Helper Link** with a shopping companion.
3. **The Helper** proposes garments from online stores matching the allowed categories, but **NEVER sees or receives the wearer's photo or try-on render.**
4. **The Server** orchestrates YouCam's official **AI Clothes V4 API** (`/s2s/v2.0/task/cloth-v4`) asynchronously, sanitizing metadata in-memory via Sharp and relaying the visual result **strictly into the Wearer's Private Mirror**.
5. **The Wearer** casts a standardized verdict (**Approve / Maybe / Pass**) with an optional safe note, giving the helper the exact styling signal they need without exposing personal pixels.

---

## 2. Architecture & The Server-Enforced Privacy Boundary

![WearerKey Architecture](docs/assets/architecture-diagram.svg)

### Trust Boundaries & Safeguards
- **Zero Photo Leakage:** Helper route handlers (`/api/helper/*`) completely omit wearer photos and try-on stream URLs from all response DTOs.
- **In-Memory Sanitization:** Before sending images to YouCam's File API, GPS coordinates, device tags, and camera metadata are stripped in memory via Sharp.
- **Capability Tokens:** Role authorization is governed by cryptographically random 32-byte capability tokens stored solely as SHA-256 hashes and compared in constant time (`crypto.timingSafeEqual`).
- **Encrypted Provider Identifiers:** Remote task IDs and ephemeral provider URLs are encrypted at rest using AES-256-GCM.
- **Provider Deletion Lifecycle:** WearerKey issues explicit deletion requests (`DELETE /s2s/v2.0/file/{fileId}` and `POST /s2s/v2.0/task/delete`) upon session completion or revocation, producing a signed HMAC audit receipt.

---

## 3. 30-Second Judge Tour

We built an interactive, pre-seeded evaluation suite that allows hackathon judges to test both roles side-by-side in under 30 seconds with 1 click:

1. Start the server (or open the public deployment).
2. Navigate to **`/judge`**.
3. Click **"Launch Interactive Split-Screen"**.
4. Observe the **Wearer Control Room** on the left (showing the full private mirror and decision slip) alongside the **Helper Workspace** on the right (showing permitted categories and proposal tools with **zero wearer images**).
5. Open browser Developer Tools (`Network` tab) on the Helper pane to verify that zero wearer image requests or payloads are ever sent to the helper.

---

## 4. YouCam AI Clothes V4 Engine Integration

WearerKey integrates with Perfect Corp's official YouCam Clothes V4 Server-to-Server API:
- **Base Endpoint:** `https://yce-api-01.makeupar.com` (India region)
- **File Upload:** `POST /s2s/v2.0/file` (uploads reference and candidate garments, receives ephemeral file IDs).
- **Task Dispatch:** `POST /s2s/v2.0/task/cloth-v4` (executes virtual garment drape across supported categories: `upper_body`, `lower_body`, `full_body`, `outer`, `shoes`, `auto`).
- **Asynchronous Polling:** `GET /s2s/v2.0/task/cloth-v4/{taskId}` with exponential backoff.
- **Remote Deletion:** `DELETE /s2s/v2.0/file/{fileId}` and `POST /s2s/v2.0/task/delete` upon completion.
- **Fail-Closed Provider Modes:**
  - `LIVE_YOUCAM`: Active when `YOUCAM_API_KEY` is present.
  - `RECORDED_LIVE_RESULT`: Transparent replay of genuine YouCam test fixtures when key is unconfigured.
  - `DEMO_FIXTURE`: Deterministic offline evaluation mode.

Verified connectivity receipt is tracked in [`docs/live-youcam-receipt.json`](docs/live-youcam-receipt.json).

---

## 5. Quickstart & Local Development

### Prerequisites
- Node.js v20+ or v24+
- `pnpm` v9+ or v12+

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/abhijeetnardele24-hash/youcam-wearerkey.git
cd youcam-wearerkey

# Install dependencies across all workspaces
pnpm install

# Copy environment template
cp .env.example .env

# Run master verification suite (unit tests, integration tests, web build, security scan, claims check)
pnpm run verify

# Mode A: Development Mode (Vite on port 3000 proxying /api to Fastify on port 4000)
pnpm dev

# Mode B: Production / Standalone Mode (Unified Fastify server on port 3000 serving API + built SPA)
pnpm build
pnpm start
```

Visit `http://localhost:3000` in your browser.

---

## 6. Monorepo Structure

```text
youcam-wearerkey/
├── apps/
│   ├── api/                     # Fastify backend, capability auth, YouCam adapter, PGlite DB
│   │   ├── src/db/              # Drizzle schema (sessions, proposals, tasks, receipts)
│   │   ├── src/providers/youcam # YouCam Clothes V4 live, recorded, and fake providers
│   │   ├── src/routes/          # Role-isolated route handlers (wearer, helper, sessions, judge)
│   │   └── src/services/        # Sharp in-memory sanitizer, SSE event bus
│   └── web/                     # React 18 + Vite + Tailwind frontend ("fitting-room" palette)
│       ├── src/components/      # VisibilityRail, ConsentSeal, PrivateMirror, DecisionSlip
│       └── src/pages/           # HomePage, CreatePassPage, WearerRoom, HelperRoom, JudgeTour
├── packages/
│   ├── contracts/               # Zod schemas, DTOs, and TypeScript contract types
│   └── domain/                  # Capability tokens, state machines, Consent Gate, crypto
├── docs/                        # Complete documentation, receipts, and SVG assets
│   ├── assets/                  # Architecture diagrams & 1280x720 Devpost thumbnail
│   ├── ARCHITECTURE.md          # In-depth architectural blueprint & trust boundaries
│   ├── PRIVACY_MODEL.md         # Role-separated threat model & authorization invariants
│   ├── YOUCAM_INTEGRATION.md    # Detailed Perfect Corp Clothes V4 API specification
│   ├── DEVPOST_SUBMISSION.md    # Complete Devpost submission package
│   ├── JUDGE_TOUR.md            # Evaluator 30-second walkthrough guide
│   ├── THREAT_MODEL.md          # Comprehensive security threat analysis & mitigations
│   ├── EVALUATION.md            # Full verification report, benchmarks & test ledger
│   ├── VIDEO_STORYBOARD.md      # Timed script & visual storyboard for demo video
│   ├── SUBMISSION_CHECKLIST.md  # Official checklist with truthful auditor verdict
│   ├── evidence-index.json      # Structured machine-readable compliance index
│   ├── deployment-receipt.json  # Port setup and deployment verification receipt
│   └── live-youcam-receipt.json # Truthful machine-verifiable connectivity receipt
├── scripts/                     # Master verifier, live smoke, security scanner, claims auditor
└── tests/                       # Unit tests, integration tests & Playwright e2e/axe tests
```

---

## 7. Mandatory AI & VTO Safety Disclosures

> **VISUAL APPEARANCE PREVIEW ONLY**  
> WearerKey simulates clothing drape and aesthetic coordination using YouCam AI Clothes V4. It is an aesthetic decision aid, not a certified sizing, tailoring, stretch, or physical fabric guarantee.  
> The system operates fail-closed: it never fabricates live API execution without genuine cryptographic evidence, and strictly ensures helper contexts cannot inspect wearer photos.

---

## 8. License

WearerKey is open-source software licensed under the [MIT License](LICENSE).
