# WearerKey — Devpost Submission Package

## Project Title
**WearerKey — Private Collaborative Virtual Try-On**

## Tagline
*Shop together without sharing the wearer's photo: privacy-first collaborative fashion try-on powered by Perfect Corp's YouCam AI Clothes V4.*

---

## Inspiration

Collaborative shopping is one of the most natural social interactions in fashion: we text friends, ask our partners, or hire stylists to help us choose what to buy. But today's virtual try-on (VTO) tools force an uncomfortable all-or-nothing choice: **to see if an outfit works on you, you must share your unedited body photo or screenshots of yourself with other people.**

For many shoppers—particularly women, people with body sensitivity, those practicing religious modesty, or anyone who values personal digital dignity—uploading full-body selfies into chat threads or sharing them with companions is unacceptable.

We asked: **What if shopping companions could curate outfits and request virtual try-ons without ever seeing the wearer's photo?**

---

## What It Does

**WearerKey** is a private collaborative virtual try-on protocol powered by **Perfect Corp's YouCam AI Clothes V4 API**:

1. **Private Wearer Setup:** The wearer sets an immutable **Consent Seal** (approved garment categories like tops, outerwear, or dresses; maximum candidate cap; expiration duration) and privately uploads their reference photo.
2. **Role-Separated Helper Workspace:** The wearer shares a single-use **Helper Link**. The helper can search online stores, upload garment product photos, and request virtual try-ons—but the helper's interface **strictly never displays the wearer's photo or try-on render**.
3. **Server-Enforced YouCam Orchestration:** When a try-on is requested, WearerKey validates the proposal against the Consent Gate, sanitizes EXIF/GPS metadata server-side in memory with Sharp before provider transmission, and dispatches an asynchronous task to YouCam's official Clothes V4 API (`/s2s/v2.0/task/cloth-v4`).
4. **Private Fitting Mirror:** The resulting try-on render streams directly into the **Wearer's Private Mirror only**, watermarked with responsible AI disclaimers.
5. **Decisive Feedback Slips:** The wearer casts a standardized verdict (**Approve / Maybe / Pass**) and writes a safe note (e.g., *"Love the drape, ordering medium"*). The helper receives only this feedback signal.
6. **Cryptographic Deletion Receipts:** Once the session is completed or revoked, WearerKey executes immediate deletion requests against remote provider tasks and files (`POST /s2s/v2.0/task/delete`, `DELETE /s2s/v2.0/file/{fileId}`), producing an HMAC-SHA256 signed audit receipt v2.0 proving application ledger authenticity based on recorded provider responses.

---

## How We Built It

- **Monorepo Architecture:** Clean TypeScript monorepo with `packages/contracts` (Zod schemas & DTOs), `packages/domain` (cryptographic token hashing, state machines, consent gate), `apps/api` (Fastify S2S API & Sharp in-memory sanitizer), and `apps/web` (React 18 + Vite SPA).
- **Server-Enforced Role Separation:** Tested helper routes expose no wearer or result image bytes; helper endpoints (`/api/helper/*`) completely omit wearer photos and try-on stream URLs from their data transfer objects. Tokens are hashed with SHA-256 and compared in constant time with `crypto.timingSafeEqual`.
- **YouCam Clothes V4 Integration:** Full asynchronous task orchestration implementing File API upload, category mapping (`upper_body`, `lower_body`, `full_body`, `outer`, `shoes`, `auto`), status polling, and official task deletion (`POST /s2s/v2.0/task/delete`).
- **Thoughtful Fitting-Room Visual Design:** Built with a custom palette inspired by warm parchment (`#F5F0E7`), deep bottle green (`#1F624F`), and muted aubergine (`#70465E`), featuring the **VisibilityRail**, **ConsentSeal**, and **PrivateMirror**.

---

## Potential Impact & Target Users

### Who Benefits Most
- **Privacy-Conscious Shoppers:** Everyday shoppers wanting fashion advice from friends without uploading vulnerable full-body selfies to unencrypted messaging apps.
- **Shoppers with Body-Image Sensitivity:** Consumers experiencing anxiety around physical appearance and body scrutiny during collaborative shopping.
- **Modest-Fashion Customers:** Communities with cultural, ethical, or religious privacy norms regarding bodily modesty.
- **Remote Personal Stylists:** Professional fashion advisors and retail clienteling teams seeking a privacy-preserving protocol to style clients without taking custody of private client photographs.
- **Friends & Family Assisting Purchases:** Gift-givers, partners, and family members collaborating on wardrobe curation.

### Retail Value Hypothesis
- **Reduced Abandonment:** Lowers drop-off at the consideration stage when shoppers desire feedback but resist sharing raw body photos.
- **Higher Collaborative Confidence:** Facilitates decisive purchases through private feedback loops (Approve / Maybe / Pass) without friction.
- **Fewer Uncontrolled Copies:** Prevents raw personal photographs from leaking into group chats, phone camera rolls, and third-party cloud photo caches.

---

## Challenges We Overcame

1. **Strict Server-Enforced Privacy Boundary:** Ensuring that no combination of client-side inspection, DevTools network sniffing, or API parameter manipulation could ever reveal the wearer's photo to the helper required strict server-enforced route authorization and distinct DTO boundaries.
2. **Ephemeral Provider Lifecycle:** Ensuring reference images do not persist on provider storage by coupling task completion with automated deletion requests against both tasks and image files.
3. **Truthfulness and Fail-Closed Engineering:** Designing clear distinctions between live YouCam execution, recorded live replays, and offline fixtures so the system never makes unverified claims.

---

## Accomplishments We're Proud Of

- **30-Second Judge Tour:** Evaluators can visit `/judge` and launch a pre-seeded, side-by-side interactive split screen that demonstrates the cryptographic boundary live in 30 seconds.
- **90 Automated Tests Passing (80 Vitest + 10 Playwright/Axe across Desktop & Mobile):** Thorough verification of cryptographic domain primitives, consent gates, YouCam Clothes V4 contract mocks, state transitions, end-to-end two-role API integration, full e2e browser journey, and WCAG 2.1 AA accessibility (0 Axe violations in tested states).
- **Single-Container Unified Delivery:** Fastify serves both the secure API and the production-built React frontend with zero external runtime dependencies.

---

## Disclaimers & Responsible AI

- **Visual Appearance Preview Only:** Virtual try-on provides an aesthetic coordination and appearance simulation using YouCam AI Clothes V4; it is not a certified sizing, tailoring, stretch, or physical fabric guarantee.
- **Deletion Audit Ledger:** The HMAC-SHA256 signature establishes application ledger authenticity. Deletion confirmation indicates recorded HTTP responses from YouCam S2S deletion endpoints (`POST /s2s/v2.0/task/delete` and `DELETE /s2s/v2.0/file/{fileId}`).
- **Accessibility:** 0 Axe-core violations verified across tested views (Home, Create, Judge Tour, Wearer Room, Helper Room).

---

## What We Learned

We discovered that separating the *browsing role* from the *fitting role* completely transforms virtual try-on from an isolating solo tool into a fun, safe social shopping experience. YouCam AI Clothes V4 provides the exact realism needed for confidence, while the protocol guarantees peace of mind.

---

## What's Next for WearerKey

- Direct e-commerce plugin for Shopify and headless fashion retailers.
- Multi-helper fashion styling parties with vote aggregation.
- Ephemeral encrypted peer-to-peer WebRTC video mirrors for live shopping calls.
