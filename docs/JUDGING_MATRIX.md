# WearerKey — Official Hackathon Judging Criteria & Verification Matrix

**Hackathon:** YouCam API Skin AI & eCommerce VTO Hackathon 2026  
**Project:** WearerKey — Private Collaborative Virtual Try-On Protocol  
**Engine:** YouCam AI Clothes Virtual Try-On V4 API (`/s2s/v2.0/task/cloth-v4`)  
**Audit Baseline:** Exact Git HEAD evaluation  

---

## 1. Rubric Overview & Tie-Break Priority

The competition evaluates submissions across four equally weighted criteria (25% each):
1. **Technological Implementation (First Tie-Break Criterion)**
2. **Design**
3. **Potential Impact**
4. **Quality of Idea**

Because **Technological Implementation** serves as the primary tie-breaker, genuine YouCam S2S API integration, server-enforced security boundaries, verifiable cryptographic receipts, and resilient system execution take precedence over decorative UI features.

---

## 2. Detailed Alignment Matrix

| Criterion | Weight | Product Feature | Working Demo Moment | Implementation Evidence | Automated / Verification Gate | Submission Paragraph | Remaining Risk & Mitigation |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Technological Implementation** | 25% *(Tie-Break)* | • Server-to-server orchestration of YouCam AI Clothes V4 (`/s2s/v2.0/task/cloth-v4`).<br>• Presigned S2S File API protocol (`/s2s/v2.0/file`).<br>• In-memory EXIF metadata stripping via Sharp.<br>• AES-256-GCM identifier encryption at rest.<br>• Versioned application-signed HMAC audit receipts.<br>• Single-use fragment bootstrap with atomic 409 replay protection.<br>• Role-separated `HttpOnly` session cookies. | **Judge Tour (`/judge`):**<br>1-click launch initiates side-by-side split-view.<br>Inspecting Helper network traffic proves zero image bytes, URLs, or wearer metadata are transmitted.<br>Wearer room streams generated VTO result and triggers remote file deletion upon revocation. | • `apps/api/src/providers/youcam/youcam-provider.ts`<br>• `packages/domain/src/crypto.ts`<br>• `apps/api/src/middleware/auth.ts`<br>• `apps/api/src/routes/sessions.ts`<br>• `apps/api/src/routes/receipts.ts` | • 70 Vitest unit and integration tests.<br>• 10 Playwright E2E browser tests.<br>• Secret-scan (0 tracked secrets).<br>• Constant-time verification tests.<br>• Race-condition concurrency tests for atomic bootstrap. | "How We Built It" & "Technical Architecture": Details Fastify backend, Sharp in-memory sanitizer, Clothes V4 async polling, and cryptographic audit ledger. | **Risk:** Provider rate limits or live key absence.<br>**Mitigation:** Transparent fail-closed modes (`LIVE_YOUCAM` vs `RECORDED_LIVE_RESULT` / `DEMO_FIXTURE`) with clear provenance disclosures. |
| **2. Design** | 25% | • "Fitting-room" editorial aesthetic: parchment (`#F5F0E7`), deep bottle green (`#1F624F`), aubergine (`#70465E`).<br>• Dedicated **VisibilityRail** illustrating live data access per role.<br>• Immutable **ConsentSeal** visual badge.<br>• **PrivateMirror** responsive canvas.<br>• Responsive 390px mobile viewport adaptation. | **Split-Screen & Mobile Views:**<br>Wearer and Helper workspaces feature clear role-specific headers and visual boundaries.<br>Decision slip allows 1-click feedback (Approve / Maybe / Pass) without visual noise. | • `apps/web/src/components/VisibilityRail.tsx`<br>• `apps/web/src/components/ConsentSeal.tsx`<br>• `apps/web/src/components/PrivateMirror.tsx`<br>• `apps/web/src/pages/JudgeTourPage.tsx` | • Playwright responsive tests at 1280x720 and 390x844.<br>• Automated Axe-core accessibility scans with 0 violations across Home, Create, and Judge views.<br>• Keyboard tab order & focus management. | "Design & User Experience": Explains the fitting-room visual language, cognitive clarity of the split-perspective, and accessibility accommodations. | **Risk:** Dense information overload for evaluators.<br>**Mitigation:** 30-second Judge Tour with visual status badges and clean typography hierarchy. |
| **3. Potential Impact** | 25% | • Solves the core privacy barrier preventing collaborative shopping in eCommerce.<br>• Addresses body sensitivity, religious modesty, and personal privacy concerns.<br>• Decouples garment discovery from photo surrender.<br>• Enterprise extension: Shopify plugin & headless retail API ("Ask someone to try this privately"). | **Collaborative Decision Loop:**<br>Helper proposes candidate dress or coat; wearer receives render in private mirror; helper receives standardized verdict slip.<br>Session revoke executes remote deletion with auditable proof. | • `apps/api/src/routes/helper.ts`<br>• `apps/api/src/routes/wearer.ts`<br>• `docs/DEVPOST_SUBMISSION.md` (retail impact calculations) | • E2E two-role integration test (`tests/integration/api.test.ts`).<br>• Session revocation and deletion lifecycle verification. | "Inspiration" & "What It Does": Highlights consumer anxiety around sharing raw body photos in chat apps and the retail conversion unlock of private collaborative shopping. | **Risk:** Overclaiming sizing or fit guarantees.<br>**Mitigation:** Clear Responsible AI and Visual Preview Only disclosures across UI, documentation, and video. |
| **4. Quality of Idea** | 25% | • Non-obvious protocol: reverses the traditional "single-user virtual mirror" pattern into a two-party consent protocol.<br>• Least-privilege fashion curation: shopping companion curates style while wearer retains absolute pixel custody.<br>• Auditable privacy lifecycle: explicit data purge asserting remote deletion. | **30-Second Realization:**<br>Judge immediately understands: "Shop together without sharing the wearer's photo."<br>Clear contrast against ordinary selfie-upload tools. | • `PROJECT_BLUEPRINT.md`<br>• `docs/PRIVACY_MODEL.md`<br>• `docs/THREAT_MODEL.md` | • Claims validation suite (`scripts/check-claims.ts`) enforcing zero hyperbolic or unverified statements. | "Inspiration" & "What We Learned": Explains why separating browsing from fitting creates a secure, joyful social shopping experience. | **Risk:** Being perceived as another generic styling assistant.<br>**Mitigation:** Immediate 30-second demonstration of the server-enforced privacy boundary. |

---

## 3. Evaluation Verification Protocol

1. **Local Tour Verification:**
   Judges navigate to `/judge` and click "Launch Interactive Split-Screen" to test both perspectives simultaneously in under 30 seconds.
2. **Network Boundary Inspection:**
   Judges open Developer Tools on the Helper pane to observe that no network calls retrieve or contain wearer images.
3. **Auditable Deletion Verification:**
   Judges trigger session revocation and inspect the tamper-evident HMAC assertion proving in-memory purge and remote deletion requests.

