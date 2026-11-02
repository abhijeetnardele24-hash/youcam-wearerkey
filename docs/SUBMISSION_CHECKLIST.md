# WearerKey — Official Hackathon Submission Checklist & Auditor Ledger

**Hackathon:** Perfect Corp AI Hackathon 2026  
**Project:** WearerKey — Private Collaborative Virtual Try-On  
**Engine:** YouCam AI Clothes V4 (`/s2s/v2.0/task/cloth-v4`)  
**Audit Timestamp:** October 2026  
**Auditor Verdict:** `INTERNAL_COMPLETE_EXTERNAL_ACTION_REQUIRED`  

---

## 1. Compliance & Evidence Checklist

| Requirement | Description | Status | Evidence Location |
| :--- | :--- | :---: | :--- |
| **Monorepo Build** | Full TypeScript compilation across contracts, domain, api, and web | ✅ PASSED | `pnpm run build` exits 0 |
| **Unit & Integration Tests** | 110 Vitest unit & API integration tests passing (7 suites) | ✅ PASSED | `tests/unit/*.test.ts`, `tests/integration/api.test.ts` |
| **E2E Browser Tests** | 12 Playwright browser tests across Desktop Chrome and Mobile (390px) | ✅ PASSED | `tests/e2e/e2e-journey.spec.ts` |
| **Accessibility (WCAG 2.1 AA)** | Axe-core accessibility scan on Home, Create, and Judge pages with zero disabled rules | ✅ PASSED | 0 violations recorded |
| **Security & Secrets** | Zero tracked secrets, API keys, or private tokens in git history | ✅ PASSED | `scripts/security-scan.ts` |
| **YouCam Clothes V4 Adapter** | Official S2S protocol (`/s2s/v2.0/file`, `/s2s/v2.0/task/cloth-v4`, `/s2s/v2.0/task/delete`) | ✅ PASSED | `apps/api/src/providers/youcam/` |
| **Server-Enforced Privacy Boundary** | Zero wearer or result images serialized to helper endpoints | ✅ PASSED | `tests/integration/api.test.ts` |
| **Deletion State Machine** | Independent task, source, and garment tracking with `purged_at=null` on failure | ✅ PASSED | `apps/api/src/routes/sessions.ts` |
| **HMAC Signed Receipts** | Alphabetical canonicalization and constant-time HMAC-SHA256 signature verification | ✅ PASSED | `apps/api/src/routes/receipts.ts`, `packages/domain/src/crypto.ts` |
| **30-Second Judge Tour** | 1-click pre-seeded split-screen evaluation tool at `/judge` | ✅ PASSED | `apps/web/src/pages/JudgeTourPage.tsx` |
| **Documentation Honesty** | Prohibited marketing buzzwords eliminated; zero unsupported claims | ✅ PASSED | `scripts/check-claims.ts` |
| **Live YouCam API Execution** | Genuine live S2S execution receipt with verified task ID | ⏳ PENDING | Requires user-provided `YOUCAM_API_KEY` |
| **Public HTTPS Deployment** | Public web endpoint for judge access (valuable enhancer; core requirements are repo, video, description, screenshots) | ⏳ PENDING / LOCAL VERIFIED | Run `scripts/deploy-smoke.ts` |
| **Demo Video Upload** | 2-3 minute YouTube/Vimeo demo video | ⏳ PENDING | Follow `docs/VIDEO_STORYBOARD.md` |
| **Devpost Final Form** | Final form submission on Devpost portal | ⏳ PENDING | Follow `docs/DEVPOST_SUBMISSION.md` |

---

## 2. Port & Deployment Configuration

- **Local Development Mode:**
  - Frontend: `http://localhost:3000` (Vite dev server proxying `/api` requests to backend).
  - Backend: `http://localhost:4000` (Fastify API server with in-memory PGlite).
  - Command: `pnpm dev`
- **Production / Container Mode:**
  - Unified Server: `http://localhost:3000` (Fastify serving API routes and built SPA static bundle at `/`).
  - Command: `pnpm build && pnpm start`

---

## 3. Truthful Verdict Declaration

The engineering, security, accessibility, and architectural deliverables for WearerKey are **fully verified internally**. Because live YouCam API execution, public cloud deployment, demo video recording, and final Devpost submission require external user action and credentials, the honest status of this project is:

```
INTERNAL_COMPLETE_EXTERNAL_ACTION_REQUIRED
```

*Never declare `SUBMISSION_READY` until live provider verification, video, and deployment receipts exist.*
