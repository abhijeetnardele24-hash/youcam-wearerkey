# Devpost Submission — WearerKey

## Project Details

- **Title:** WearerKey — Private Collaborative Virtual Try-On
- **Tagline:** Shop together without sharing the wearer's photo.
- **Hackathon:** YouCam API Skin AI & eCommerce VTO Hackathon 2026
- **Repository:** `https://github.com/abhijeetnardele24-hash/youcam-wearerkey`
- **Built with:** YouCam AI Clothes V4, Fastify, TypeScript, React 18, Vite, TailwindCSS, Sharp, PGlite, Zod, Vitest.

---

## Inspiration

Collaborative shopping is one of the most natural social interactions in fashion: we text friends, ask our partners, or hire stylists to help us choose what to buy. But today's virtual try-on (VTO) tools force an uncomfortable all-or-nothing choice: **to see if an outfit works on you, you must share your unedited body photo or screenshots of yourself with other people.**

For millions of people, this is a privacy deal-breaker. Whether due to body vulnerability, personal boundaries, religious practices, or workplace privacy, people don't want their full-body reference photos circulating across messaging apps or stored indefinitely on third-party servers.

We asked: **What if shopping companions could curate outfits and request virtual try-ons without ever seeing the wearer's photo?**

---

## What It Does

**WearerKey** is a private collaborative virtual try-on protocol powered by **Perfect Corp's YouCam AI Clothes V4 API**:

1. **Private Wearer Setup:** The wearer sets an immutable **Consent Seal** (approved garment categories like tops, outerwear, or dresses; maximum candidate cap; expiration duration) and privately uploads their reference photo.
2. **Zero-Knowledge Helper Workspace:** The wearer shares a single-use **Helper Link**. The helper can search online stores, upload garment product photos, and request virtual try-ons—but the helper's interface **strictly never displays the wearer's photo or try-on render**.
3. **Server-Enforced YouCam Orchestration:** When a try-on is requested, WearerKey validates the proposal against the Consent Gate, sanitizes EXIF data in memory with Sharp, and dispatches an asynchronous task to YouCam's official Clothes V4 API (`/s2s/v2.0/task/cloth-v4`).
4. **Private Fitting Mirror:** The resulting try-on render streams directly into the **Wearer's Private Mirror only**, watermarked with responsible AI disclaimers.
5. **Decisive Feedback Slips:** The wearer casts a standardized verdict (**Approve / Maybe / Pass**) and writes a safe note (e.g., *"Love the collar, but prefer a darker shade"*). The helper receives only this feedback signal.
6. **Automatic Deletion Receipts:** Once the session is completed or revoked, WearerKey requests immediate deletion of remote provider files and issues a cryptographic audit receipt.

---

## How We Built It

- **Monorepo Architecture:** Clean TypeScript monorepo with `packages/contracts` (Zod schemas & DTOs), `packages/domain` (cryptographic token hashing, state machines, consent gate), `apps/api` (Fastify S2S API & Sharp in-memory sanitizer), and `apps/web` (React 18 + Vite SPA).
- **Zero-Leakage Security Model:** Helper endpoints (`/api/helper/*`) completely omit wearer photos and try-on stream URLs from their data transfer objects. Tokens are hashed with SHA-256 and compared in constant time with `crypto.timingSafeEqual`.
- **YouCam Clothes V4 Integration:** Full asynchronous task orchestration implementing File API upload, category mapping (`upper_body`, `lower_body`, `full_body`, `outer`, `shoes`, `auto`), status polling, and remote file deletion.
- **Thoughtful Fitting-Room Visual Design:** Built with a custom palette inspired by warm parchment (`#F5F0E7`), deep bottle green (`#1F624F`), and muted aubergine (`#70465E`), featuring the **VisibilityRail**, **ConsentSeal**, and **PrivateMirror**.

---

## Challenges We Overcame

1. **Strict Zero-Knowledge Enforcement:** Ensuring that no combination of client-side inspection, DevTools network sniffing, or API parameter manipulation could ever reveal the wearer's photo to the helper required strict server-enforced route authorization and distinct DTO boundaries.
2. **Ephemeral Provider Lifecycle:** Ensuring reference images do not persist on provider storage by coupling task completion with automated file deletion requests.
3. **Truthfulness and Fail-Closed Engineering:** Designing clear distinctions between live YouCam execution, recorded live replays, and offline fixtures so the system never makes unverified claims.

---

## Accomplishments We're Proud Of

- **30-Second Judge Tour:** Evaluators can visit `/judge` and launch a pre-seeded, side-by-side interactive split screen that demonstrates the cryptographic boundary live in 30 seconds.
- **24/24 Automated Tests Passing:** Complete coverage of cryptographic domain primitives, consent gates, state transitions, and end-to-end two-role API integration.
- **Single-Container Unified Delivery:** Fastify serves both the secure API and the production-built React frontend with zero external runtime dependencies.

---

## What We Learned

We discovered that separating the *browsing role* from the *fitting role* completely transforms virtual try-on from an isolating solo tool into a fun, safe social shopping experience. YouCam AI Clothes V4 provides the exact realism needed for confidence, while the protocol guarantees peace of mind.

---

## What's Next for WearerKey

- Direct e-commerce plugin for Shopify and headless fashion retailers.
- Multi-helper fashion styling parties with vote aggregation.
- Ephemeral encrypted peer-to-peer WebRTC video mirrors for live shopping calls.
