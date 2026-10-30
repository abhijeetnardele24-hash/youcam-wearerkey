# WearerKey — Private Collaborative Virtual Try-On

> **Tagline:** Shop together without sharing the wearer's photo.
>
> **Hackathon:** YouCam API Skin AI & eCommerce VTO Hackathon 2026  
> **Research snapshot:** 30 October 2026  
> **Submission deadline:** 2 November 2026, 11:45 a.m. EST (4:45 p.m. UTC / 10:15 p.m. IST)  
> **Target prize:** Overall placement; also opt in to the Rising Star Award only if the submitted team truthfully satisfies its student-email requirement.  
> **Document role:** Single source of truth for product, implementation, verification, demo, and submission decisions.

---

## 1. Executive decision

Build **WearerKey**, a two-party virtual try-on workflow for people who shop with help from someone else.

A wearer creates a short-lived private **Try-On Pass**, uploads their own photo, and sets explicit boundaries such as allowed garment categories and session expiry. A helper—friend, family member, caregiver, stylist, or gift shopper—can propose a garment without receiving the wearer's photo. WearerKey sends the wearer photo and garment to the **YouCam AI Clothes Virtual Try-On V4 API**, but only the wearer can see the generated preview. The helper receives a deliberately limited signal: **Approve**, **Maybe**, **Pass**, or a wearer-written safe note.

The memorable product sentence is:

> **WearerKey lets two people shop together while the most sensitive image stays with the person it belongs to.**

This is not another personal stylist, skincare recommender, color matcher, or ordinary virtual mirror. The non-obvious use of YouCam is a **role-separated collaboration protocol** built around consent, least-privilege image access, revocation, and an auditable deletion lifecycle.

### The 20-second judge pitch

Online apparel shopping often involves another person: an adult child helping a parent, a friend comparing outfits, a remote stylist, or someone choosing a gift. Today the wearer usually has to send a full-body photo or a generated try-on screenshot into chat. WearerKey replaces that privacy leak with a controlled relay. The helper proposes a garment, YouCam generates the try-on, the wearer privately reviews it, and the helper gets only the wearer's decision.

---

## 2. Authoritative hackathon facts and hard requirements

### 2.1 Official sources

- [Hackathon overview](https://youcam-api-skin-ai-ecommerce.devpost.com/)
- [Official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules)
- [Official resources](https://youcam-api-skin-ai-ecommerce.devpost.com/resources)
- [YouCam API introduction](https://docs.perfectcorp.com/develop/introduction)
- [YouCam quick-start workflow](https://docs.perfectcorp.com/develop/quick_start_guide)
- [AI Clothes VTO overview and constraints](https://docs.perfectcorp.com/reference/ai_clothes/section/overview)
- [AI Clothes V4 endpoint](https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4/post)
- [YouCam release notes](https://docs.perfectcorp.com/release/changelog)
- [Official YouCam Skills](https://docs.perfectcorp.com/develop/agent_skills)
- [Perfect Corp announcement and prior winners](https://www.perfectcorp.com/business/news/YouCam-API-Hackthon-eCommerce)

For an India-region account, use the India-specific console and documentation linked by the hackathon resources. The documented API host is `https://yce-api-01.makeupar.com`.

### 2.2 What the rules require

| Requirement | Consequence for WearerKey |
|---|---|
| Integrate at least one eligible Perfect Corp. YouCam API | AI Clothes VTO V4 is the indispensable visual engine, not decorative integration. |
| Deliver clear consumer or eCommerce value | The two-role shopping flow solves a specific privacy and collaboration problem for assisted and social shopping. |
| Working application; non-trivial implementation | A live, deployed, end-to-end two-role application must function consistently and match the video. |
| New project or significantly updated during submission period | Create a fresh repository and preserve truthful commit history. Do not copy a prior hackathon codebase. |
| Authorized third-party integrations and assets | Use only owned, licensed, or clearly permitted demo images and libraries. Record licenses. |
| Repository with source, assets, instructions, and relevant license | Public repository is preferred. README must support a clean setup and judge tour. |
| Text description explaining features and consumer/retail value | Prepare concise Devpost copy grounded in what actually runs. |
| Screenshots | Capture the key privacy boundary, private try-on, decision relay, and deletion receipt. |
| 1–3 minute demo video | Use a **publicly visible** YouTube/Vimeo video, explain the YouCam API, and show the running product end to end. Unlisted is not compliant with the wording of these rules. |
| Free, unrestricted judge access | Keep a public HTTPS deployment available through the end of judging on 20 November 2026. No expiring quick tunnel. |
| English submission materials | UI and all primary submission assets should be English. |
| Original work and no IP/privacy infringement | Obtain written consent for any identifiable human image; use self-created or licensed garment assets. |
| Winner exit interview and blog participation | Acknowledge these in the submission if requested. |

### 2.3 Eligibility and prize notes

- Entrants must be above the legal age of majority where they reside.
- India is not in the listed exclusion set, but the entrant must independently confirm personal eligibility.
- The Rising Star Award requires at least one currently enrolled student and a valid school-issued email at submission time.
- A project can win only one prize.
- The 1,000-unit redeem code is per registrant, non-transferable, and valid for 90 days after redemption.
- The optional social-sharing bonus does not affect judging and has separate public-post/disclosure requirements. Do not spend submission time on it unless more units are actually needed.

### 2.4 YouCam implementation facts that constrain the design

- Authentication is a server-side Bearer token. Never expose it in browser code.
- Normal workflow: request a file upload URL and `file_id`, upload the bytes, submit an asynchronous task, poll or receive a webhook, then retrieve the result URL.
- AI Clothes V4 uses `POST /s2s/v2.0/task/cloth-v4` and the corresponding task-status `GET` endpoint.
- Prefer webhook completion if available and verified; otherwise poll at a documented, conservative interval (approximately 10 seconds) until `success` or `error` with a hard timeout.
- AI Clothes accepts `src_file_id`/`src_file_url` for the wearer and `ref_file_id`/`ref_file_url`/`template_id` for the garment.
- V4 supports `garment_category` values including `full_body`, `lower_body`, `upper_body`, `shoes`, `auto`, and `outer`.
- Set `filter_multi_person: "strict"` to reject images containing any additional person.
- Target images must be JPG/PNG, under 10 MB, forward-facing, contain one visible person, and meet documented resolution/pose requirements.
- A standalone lower-body product image is not supported in the same way as upper-body/product references; surface this limitation before charging a unit.
- VTO is a visual appearance preview, **not** physical-size or fit prediction. The UI and submission must never imply otherwise.
- The published unit table lists two units per AI Clothes VTO V2/V3. Before coding budget assumptions for V4, query the authenticated feature-cost endpoint or console and record the observed value. Do not silently assume V4 cost.
- Current platform releases support deleting a finished task with its associated input files and generated outputs. Implement deletion only against the exact documented endpoint and record the provider response; never claim deletion without evidence.

---

## 3. Research: the competitive field and current gap

### 3.1 Prior winning patterns to avoid copying

Perfect Corp's first hackathon already rewarded:

- **Aloud:** voice-led skin and makeup access for blind and low-vision shoppers.
- **ShadeSpan / CASTING:** catalog and garment representation across measured skin tones.
- **KeepMe:** user-controlled identity preservation during AI try-on.
- **ConfidFit:** Shopify VTO with honest “visual preview, not fit guarantee” labeling.

Repackaging accessibility, skin-tone catalog inclusion, identity preservation, or a basic Shopify widget would look derivative.

### 3.2 Strong current-entry patterns already visible

Current submissions already cover:

- product-effect tracking and measurement-noise thresholds;
- local-store skin routines and makeup try-on;
- ingredient/safety screening;
- multi-API skin/style concierges;
- color harmony and CIEDE2000 matching;
- ordinary occasion-based styling and “complete the look” cross-sell;
- two/three-garment comparison boards;
- privacy-first photo deletion;
- worker/weather-specific skincare;
- workflow governance and human approval gates.

Therefore, “upload selfie → get analysis/recommendations → try product → add to cart” is crowded even if technically polished.

### 3.3 Market and user insight

Commercial VTO normally assumes a single shopper controls both the photo and the shopping decision. Real shopping is often collaborative:

- an adult child helps a parent buy clothes remotely;
- a friend compares event outfits;
- a caregiver assists someone who finds eCommerce difficult;
- a stylist proposes items without needing permanent access to a client photo;
- a gift shopper wants validation without circulating a private image.

Typical workarounds—sending a source photo or VTO screenshot through chat—break least-privilege access and create uncontrolled copies. Privacy research on AR/VTO has repeatedly identified the sensitivity of uploaded images and opaque third-party sharing as a trust barrier. WearerKey changes the collaboration model rather than adding another recommendation layer.

---

## 4. Concept comparison and selection

### 4.1 Evaluation method

Each concept was scored from 1–10 against the factors most likely to matter under the four equal judging criteria. Weighted maximum: 100.

| Factor | Weight |
|---|---:|
| Originality / memorability | 25% |
| Feasibility before deadline | 20% |
| Depth and necessity of YouCam integration | 20% |
| Visual demo impact | 20% |
| Specific user and commercial value | 15% |

### 4.2 Shortlist

| Concept | Originality | Feasibility | YouCam centrality | Demo impact | User value | Weighted score | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| Generic skin + style concierge | 3 | 8 | 8 | 7 | 6 | 62.5 | Reject: crowded. |
| Wardrobe-first “buy less” comparison | 5 | 8 | 8 | 7 | 7 | 69.5 | Reject: close current entries exist. |
| Retail catalog inclusivity auditor | 4 | 7 | 9 | 8 | 8 | 70.5 | Reject: prior winners already own this story. |
| Return-rescue replacement recommender | 7 | 6 | 7 | 7 | 8 | 69.5 | Reject: needs commerce/order data to be credible. |
| **WearerKey: private collaborative VTO** | **9** | **8** | **9** | **9** | **9** | **88.0** | **Select.** |

### 4.3 Why WearerKey is the strongest choice

1. **The API is indispensable.** Without YouCam, there is no private visual decision for the wearer.
2. **The product is understood in one sentence.** Judges do not need a long AI explanation.
3. **It creates a fresh interaction model.** Two roles, two permission surfaces, one controlled result.
4. **It is visually demonstrable.** Two browser windows make the privacy boundary immediately visible.
5. **It has credible commercial extensions.** Retailers, remote stylists, assisted-shopping services, and gifting flows can embed the protocol.
6. **It avoids false claims.** The product improves controlled sharing and decision confidence; it does not claim garment sizing accuracy or guaranteed return reduction.

---

## 5. Product definition

### 5.1 Primary users

**Wearer**

- owns the source photo and controls who may propose garments;
- wants help shopping without sending their photo through chat;
- privately sees generated VTO results;
- controls the response and can revoke the session.

**Helper**

- friend, family member, caregiver, stylist, or gift shopper;
- proposes a garment and contextual metadata;
- never receives the wearer's raw image or private VTO result;
- receives only the wearer's explicit decision and optional safe note.

**Retail partner (future integration persona)**

- embeds “Ask someone to try this privately” on a product page;
- wants a consent-respecting path to collaborative conversion;
- does not need access to the source photo.

### 5.2 Core use cases

1. **Assisted shopping:** an adult child proposes easy-to-wear outerwear for a parent who privately reviews each preview.
2. **Remote styling:** a stylist offers candidate garments while the client retains complete image control.
3. **Friend-to-friend shopping:** one friend browses and the other privately evaluates the look.
4. **Gift mode:** the wearer sees the garment preview but not the helper identity, price, store, or gift message until reveal. This preserves part of the surprise without pretending the garment itself remains secret.

### 5.3 The core loop

1. Wearer creates a Try-On Pass.
2. Wearer chooses allowed garment categories, maximum proposals, expiry, and whether helper notes are allowed.
3. Wearer reads concise consent text and uploads a valid source image.
4. WearerKey strips metadata, validates the image, uploads directly to YouCam, and stores only an encrypted provider file identifier plus a local content hash.
5. WearerKey generates two capabilities: a wearer management link and a helper proposal link. Each is shown once and stored only as a hash.
6. Helper opens the proposal link. The UI confirms that the wearer image is private.
7. Helper uploads a licensed garment image and optional label, category, price, and product URL. Brand/store fields are hidden in Gift Mode.
8. The **Consent Gate** checks session state, category permission, expiry, proposal limit, image validity, idempotency, and API budget before any paid call.
9. WearerKey uploads the garment, creates a live YouCam AI Clothes V4 task, and records a sanitized receipt.
10. Wearer receives a live update and privately views the generated result with the disclaimer “visual appearance preview—not size or physical-fit prediction.”
11. Wearer selects Approve, Maybe, or Pass and optionally sends a short note from a constrained field.
12. Helper receives the decision but never the source or result image.
13. Wearer revokes the Try-On Pass or the TTL expires. WearerKey requests provider deletion, removes local access, and produces a truthfully scoped deletion receipt.

### 5.4 Explicit product boundaries

WearerKey does **not**:

- predict garment size, physical fit, drape, comfort, or return probability;
- diagnose skin or provide medical advice;
- scrape retailer pages or copy product imagery without permission;
- identify the wearer or infer demographics;
- use face recognition;
- expose the wearer's source/result image to the helper;
- claim provider deletion unless the provider confirms it;
- send a purchase or message automatically;
- require a user account for the prototype.

---

## 6. Feature specification

### 6.1 P0 — submission-critical features

1. **Two-role Try-On Pass**
   - cryptographically random wearer and helper capabilities;
   - tokens are shown once, stored only as SHA-256 hashes;
   - role-scoped authorization on every endpoint.

2. **Consent Gate**
   - explicit consent version and timestamp;
   - allowed garment categories;
   - session TTL (15 minutes, 1 hour, or 24 hours; demo defaults to 1 hour);
   - maximum candidate count;
   - revocation at any time;
   - blocked-state explanation that tells the user exactly what must change.

3. **Private image upload pipeline**
   - MIME/magic-byte validation, dimensions, file size, and single-person expectations;
   - EXIF/metadata stripping and normalization in memory;
   - no raw-image logging;
   - direct, short-lived upload to the YouCam File API;
   - no helper read path to wearer input or output.

4. **Live YouCam AI Clothes V4 integration**
   - server-only key;
   - official India-region host for an India-region account;
   - `filter_multi_person: "strict"`;
   - explicit or `auto` category after local gate;
   - asynchronous task lifecycle with polling/webhook, timeout, and mapped errors;
   - honest `LIVE_YOUCAM` vs `DEMO_FIXTURE` mode badge;
   - at least one sanitized successful live receipt bound to exact commit SHA.

5. **Wearer-only review room**
   - result image accessible only with wearer capability;
   - garment metadata and disclaimers;
   - Approve / Maybe / Pass with optional note;
   - keyboard and screen-reader accessible.

6. **Helper decision board**
   - task state and wearer decision only;
   - no source photo, result photo, provider file ID, or hidden metadata in HTML, API JSON, logs, prefetches, or browser caches;
   - clear “private by design” empty/loading states.

7. **Revocation and deletion receipt**
   - revoke immediately blocks both role links;
   - request exact documented YouCam resource deletion for completed tasks;
   - record `confirmed`, `failed`, `not_supported`, or `pending`—never a vague “deleted” claim;
   - purge local metadata after receipt retention window.

8. **Judge demo mode**
   - one-click seeded session using owned/licensed images;
   - a pre-recorded successful live receipt can replay the already-generated result only when labeled `RECORDED_LIVE_RESULT` with source commit/task evidence;
   - an optional `DEMO_FIXTURE` mode keeps UI explorable if units are exhausted, but cannot be presented as live API proof.

### 6.2 P1 — high-value polish

- Split-screen “Wearer / Helper” judge tour launcher.
- Server-Sent Events for near-real-time task/decision updates.
- Unit budget ledger with estimate, reservation, completion, failure, and idempotency key.
- Input readiness coach showing exact YouCam photo requirements before upload.
- Gift Mode hiding helper identity, price, URL, and note until the wearer decides.
- Downloadable privacy receipt in JSON and printable HTML.
- A retailer handoff payload after approval (no real checkout): selected SKU, decision, and consent-safe session reference.

### 6.3 P2 — optional only after all gates pass

- QR code for helper link.
- More than one helper per session with separate capability tokens.
- Retailer widget package.
- YouCam YouCam Skills/CLI integration for a developer-only live smoke command.
- Localized UI.

Do not add an LLM merely to call the project “agentic.” The consent state machine and YouCam task orchestrator already provide meaningful autonomy. An LLM would increase latency, privacy surface, and nondeterminism without improving the core decision.

---

## 7. Judge-criteria strategy

All four Stage Two criteria are equally weighted. Stage One is pass/fail on viability and genuine YouCam use.

### 7.1 Technological Implementation

**What judges should see**

- Real AI Clothes V4 task lifecycle: file preparation, upload, task creation, asynchronous completion, result, and resource deletion.
- Role-based privacy enforced server-side—not CSS hiding.
- Strict multi-person rejection and mapped YouCam validation errors.
- Idempotency and an auditable unit ledger.
- Live receipt with exact API family, task status, timestamps, unit estimate/observed cost if available, deployment commit, and redacted identifiers.
- Tests proving the helper cannot fetch source/result assets.

**Evidence**

- architecture diagram;
- integration tests with a fake YouCam server;
- live smoke script and sanitized receipt;
- authorization regression tests;
- CI artifact linked from README.

### 7.2 Design

**What judges should feel**

- The two-role relationship is understood immediately.
- Every screen answers: “Who can see what?”
- The interface feels calm and intentional, not like an AI dashboard.
- Loading, error, expired, revoked, and deletion states are complete.
- Mobile helper flow and desktop wearer flow both work.

### 7.3 Potential Impact

**Credible claim**

WearerKey reduces the need to distribute a wearer photo or generated try-on screenshot during collaborative shopping. It gives the wearer direct control of the preview and the helper a useful decision signal.

**Do not claim without a study**

- a percentage reduction in returns;
- increased conversion;
- regulatory compliance certification;
- guaranteed privacy;
- size accuracy.

**Prototype evaluation**

- zero helper endpoints return source/result URLs;
- all role-boundary tests pass;
- a first-time tester completes the two-role flow without instruction;
- median task completion and error recovery are recorded from actual runs;
- a five-person moderated usability test is optional if genuine and documented.

### 7.4 Quality of Idea

Position the novelty as **a collaboration protocol, not an image filter**:

- ordinary VTO assumes one person owns photo, browsing, and decision;
- WearerKey separates those responsibilities;
- YouCam remains central to the decisive private visual moment;
- consent, visibility, and deletion are product interactions rather than policy-page text.

---

## 8. User experience and visual system

### 8.1 Visual direction

**Concept:** “sealed parcel meets fitting-room mirror.”

- Canvas: warm parchment `#F5F0E7`
- Primary ink: near-black green `#15201D`
- Wearer role: deep bottle green `#1F624F`
- Helper role: muted aubergine `#70465E`
- Privacy seal / warning: rust `#B64A35`
- Rules/borders: stone `#C8BFAF`
- Success: `#216B4B`
- Typeface: self-hosted or system-licensed humanist sans for UI; restrained serif only for display title if license is clear.

Avoid neon gradients, glassmorphism, generic chatbot cards, excessive pills, floating blobs, stock illustrations, and fake metrics.

### 8.2 Page map

1. `/` — concise value proposition, two-role animation, start CTA, privacy promise.
2. `/create` — consent and Try-On Pass setup.
3. `/wearer/:capability` — wearer control room and private result review.
4. `/helper/:capability` — helper proposal workspace.
5. `/receipt/:capability` — scoped privacy/deletion receipt.
6. `/judge` — guided split-role demo, system mode, live evidence, setup-free sample.
7. `/about` — plain-language limitations and data lifecycle.

### 8.3 Key components

- `VisibilityRail`: shows Wearer Only / Helper Can See / Provider Processing.
- `ConsentSeal`: immutable summary of permitted categories, expiry, and candidate cap.
- `ProposalCard`: garment metadata and task status.
- `PrivateMirror`: protected result viewer with watermark/disclaimer.
- `DecisionSlip`: Approve / Maybe / Pass and optional note.
- `ProviderReceipt`: mode, API, task timings, deletion status, commit SHA.
- `BoundaryDiagram`: animated but accessible flow of data between roles and YouCam.

### 8.4 Accessibility baseline

- semantic landmarks and headings;
- full keyboard support and visible focus;
- status updates via `aria-live` without repeated announcements;
- color never carries meaning alone;
- touch targets at least 44×44 CSS px;
- prefers-reduced-motion support;
- automated Axe checks plus manual keyboard review;
- meaningful alt text for garments; private wearer result uses wearer-authored or neutral alt text.

---

## 9. Technical architecture

### 9.1 Recommended stack

Use a TypeScript monorepo to minimize context switching:

- **Frontend:** React, Vite, TypeScript, React Router, TanStack Query.
- **Backend:** Fastify, TypeScript, Zod, Pino.
- **Database:** PostgreSQL with Drizzle ORM. Use a free managed Postgres instance for the public prototype; never store raw image bytes.
- **Image sanitation:** Sharp in memory.
- **Realtime:** Server-Sent Events; fall back to short polling.
- **Crypto:** Node `crypto` for random capabilities, SHA-256 token hashes, and AES-256-GCM encryption of provider identifiers.
- **Testing:** Vitest, Fastify inject, Testcontainers or isolated test DB, Playwright, `@axe-core/playwright`.
- **Documentation:** OpenAPI generated from Zod schemas, Mermaid source plus exported SVG/PNG architecture diagram.
- **Delivery:** one Docker image serving API and built frontend, plus a durable public HTTPS host.
- **CI:** GitHub Actions with Node LTS, lint, typecheck, unit/integration, production build, Playwright/Axe, secret scan, claims audit, and Docker smoke.

Before implementation, query current stable API documentation through Context7 and pin exact compatible versions in the lockfile. Do not select versions from memory.

### 9.2 High-level data flow

```text
Wearer browser                          Helper browser
     |                                      |
     | create consent + source image        | propose garment
     v                                      v
                WearerKey API
     [capability auth + Consent Gate + unit ledger]
        |               |                 |
        |               |                 +--> PostgreSQL metadata only
        |               +--> SSE role-scoped events
        v
   in-memory sanitize (Sharp)
        |
        +--> YouCam File API (source + garment)
        +--> YouCam AI Clothes V4 async task
        +<-- private result URL + task status
        |
        +--> wearer-only result proxy
        +--> helper-only decision status
        +--> deletion request + scoped receipt
```

### 9.3 Trust boundaries

1. **Browser ↔ API:** TLS; capability token presented in header or same-site secure cookie. Never put reusable capability tokens in analytics/logs.
2. **Role authorization:** route handlers resolve hashed token to exactly one role; a helper token cannot query wearer DTOs.
3. **API ↔ YouCam:** server-side Bearer token only; sanitized request/response logging.
4. **Database:** metadata and encrypted provider identifiers only; no raw images or result blobs.
5. **Result delivery:** server proxy or one-use signed relay so the helper never receives the provider result URL.

### 9.4 State machines

**Session**

```text
DRAFT -> READY -> ACTIVE -> REVOKED
                  |  |
                  |  +-> EXPIRED
                  +----> COMPLETED -> PURGING -> PURGED | PURGE_PARTIAL
```

**Proposal / YouCam task**

```text
CREATED -> GATE_BLOCKED
   |
   +-> READY -> UPLOADING -> SUBMITTED -> PROCESSING
                                      |          |
                                      |          +-> SUCCEEDED -> REVIEWED
                                      +------------> FAILED
```

Only explicit transition functions may change state. Reject impossible transitions with typed errors.

### 9.5 API surface

| Method and route | Role | Purpose |
|---|---|---|
| `POST /api/sessions` | public | Create draft session and return one-time wearer capability. |
| `PUT /api/wearer/session` | wearer | Set consent policy and upload source image. |
| `POST /api/wearer/helper-link` | wearer | Mint/show one-time helper link. |
| `GET /api/wearer/session` | wearer | Full wearer-safe session view. |
| `GET /api/helper/session` | helper | Helper-safe policy and proposal list without private images. |
| `POST /api/helper/proposals` | helper | Upload garment metadata/image. |
| `POST /api/helper/proposals/:id/generate` | helper | Request gate + YouCam task; idempotency header required. |
| `GET /api/wearer/proposals/:id/result` | wearer | Stream/proxy private result. |
| `POST /api/wearer/proposals/:id/decision` | wearer | Approve/Maybe/Pass and safe note. |
| `GET /api/events` | either | Role-scoped SSE events. |
| `DELETE /api/wearer/session` | wearer | Revoke and begin provider/local purge. |
| `GET /api/wearer/receipt` | wearer | Detailed receipt. |
| `GET /api/helper/receipt` | helper | Redacted receipt. |
| `GET /api/health` | public | Health, build SHA, provider mode; never secrets. |
| `GET /api/meta` | public | Version, deployment SHA, feature flags. |

Use headers rather than capability query strings after the initial landing exchange. Immediately remove tokens from the address bar via `history.replaceState` and set secure, HttpOnly, SameSite cookies where deployment topology permits.

### 9.6 Data model

**`relay_sessions`**

- `id` UUID
- `status`
- `wearer_token_hash`
- `helper_token_hash`
- `consent_version`
- `consented_at`
- `allowed_categories[]`
- `max_proposals`
- `expires_at`
- `gift_mode`
- `source_file_id_ciphertext`
- `source_content_hash`
- `created_at`, `updated_at`, `revoked_at`, `purged_at`

**`proposals`**

- `id`, `session_id`
- `label`, `garment_category`, `price_minor`, `currency`, `product_url`
- `garment_file_id_ciphertext`, `garment_content_hash`
- `status`, `failure_code`, `failure_message_safe`
- `created_at`, `completed_at`

**`provider_tasks`**

- `id`, `proposal_id`
- `provider = YOUCAM`
- `mode = LIVE_YOUCAM | RECORDED_LIVE_RESULT | DEMO_FIXTURE`
- `api_family = AI_CLOTHES_V4`
- `task_id_ciphertext`
- `result_url_ciphertext`
- `submitted_at`, `finished_at`
- `estimated_units`, `observed_units`
- `provider_status`, `provider_error_code`
- `receipt_sha256`, `evaluated_commit_sha`

**`decisions`**

- `proposal_id`
- `decision = APPROVE | MAYBE | PASS`
- `note`
- `decided_at`

**`audit_events`**

- append-only event type, actor role, session/proposal ID, timestamp, sanitized details, previous-event hash, event hash.
- This is an integrity chain, not a blockchain and not proof against a malicious server. Label it accurately.

**`unit_ledger`**

- idempotency key, proposal ID, estimate, reservation state, observed result, timestamps.

### 9.7 YouCam adapter contract

Create a provider interface so tests do not depend on live units:

```ts
interface ClothesTryOnProvider {
  checkCost(input: CostInput): Promise<CostEstimate>;
  uploadImage(input: SanitizedImage): Promise<ProviderFile>;
  createTask(input: ClothesTaskInput): Promise<ProviderTask>;
  getTask(taskId: string): Promise<ProviderTaskStatus>;
  deleteTask(taskId: string): Promise<ProviderDeletionResult>;
}
```

Implement:

- `YouCamClothesProvider` for live calls;
- `FakeYouCamProvider` for deterministic tests;
- `RecordedReceiptProvider` only for clearly labeled judge replay.

Map provider errors to user-safe states such as `PHOTO_TOO_SMALL`, `POSE_NOT_SUPPORTED`, `MULTIPLE_PEOPLE`, `GARMENT_REGION_MISMATCH`, `NSFW_REJECTED`, `RATE_LIMITED`, `UNITS_EXHAUSTED`, `PROVIDER_TIMEOUT`, and `PROVIDER_ERROR`. Preserve the raw code in restricted logs/receipts without exposing sensitive inputs.

### 9.8 Idempotency and cost control

- Require `Idempotency-Key` on generation.
- Derive a stable fingerprint from session, source hash, garment hash, category, and consent version.
- Place a unique database constraint on active/successful fingerprints.
- Atomically reserve the authenticated cost estimate before creating a task.
- Do not retry non-idempotent task creation after an ambiguous timeout unless the provider exposes a safe idempotency mechanism or task reconciliation path.
- Cap demo sessions and proposals; default max is three.
- Display expected units before generation when the authenticated API exposes cost.
- Store no API key or full task token in receipts.

---

## 10. Security and privacy requirements

### 10.1 Required safeguards

- server-only `YOUCAM_API_KEY`;
- `.env.example` with names only;
- secret scanning across current tree and Git history;
- capability tokens generated with at least 256 bits of randomness;
- token hashes, constant-time comparison, rate limiting, and expiry;
- AES-256-GCM encrypted provider IDs/URLs with key rotation metadata;
- image content sniffing; reject polyglot and unsupported formats;
- Sharp decode/re-encode to remove EXIF and embedded payloads;
- fixed upload/body limits and decompression-bomb protections;
- Content Security Policy, secure headers, strict CORS, CSRF protection where cookies are used;
- SSRF defense: product URL is metadata only; server must not fetch arbitrary URLs. Garments are explicit uploads or approved demo assets;
- no third-party analytics, session replay, or trackers;
- structured log redaction for tokens, URLs, image bytes, file IDs, and authorization headers;
- per-token and per-IP rate limits;
- automated TTL job and manual revoke;
- privacy copy that states YouCam is a processor in the prototype flow and links relevant terms/privacy material;
- no “GDPR compliant,” “zero risk,” or similar certification claims.

### 10.2 Authorization invariants to test

1. Helper token cannot read or infer the source image.
2. Helper token cannot read or infer the result URL/image.
3. Helper token cannot change consent or revoke the wearer.
4. Wearer token cannot be guessed from helper link or database ID.
5. Revoked/expired tokens fail closed.
6. SSE emits only role-safe DTOs.
7. OpenGraph metadata, error telemetry, logs, and browser source never contain private asset URLs.
8. A deletion failure is visible as failure, not rewritten as success.

---

## 11. Repository structure

```text
wearerkey/
├── apps/
│   ├── web/
│   │   ├── src/components/
│   │   ├── src/features/create-pass/
│   │   ├── src/features/wearer-room/
│   │   ├── src/features/helper-room/
│   │   ├── src/features/judge-tour/
│   │   └── src/styles/
│   └── api/
│       ├── src/app.ts
│       ├── src/routes/
│       ├── src/domain/
│       ├── src/providers/youcam/
│       ├── src/security/
│       ├── src/persistence/
│       └── src/jobs/
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── ui/
│   └── test-fixtures/
├── tests/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── live/
├── scripts/
│   ├── live-youcam-smoke.ts
│   ├── verify-deployment.ts
│   ├── check-claims.ts
│   ├── security-scan.ts
│   └── generate-evidence.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRIVACY_MODEL.md
│   ├── YOUCAM_INTEGRATION.md
│   ├── THREAT_MODEL.md
│   ├── EVALUATION.md
│   ├── JUDGE_TOUR.md
│   ├── DEMO_SCRIPT.md
│   ├── DEVPOST_SUBMISSION.md
│   ├── SUBMISSION_CHECKLIST.md
│   ├── verification-results.json
│   ├── live-youcam-receipt.json
│   └── assets/
├── .github/workflows/ci.yml
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── README.md
├── SECURITY.md
└── package.json
```

---

## 12. Implementation plan: verified vertical slices

### Slice 0 — Fresh repository and live feasibility spike

**Goal:** prove eligibility risk early.

1. Create a new `wearerkey` repository; do not modify or copy prior hackathon repos.
2. Register/redeem the India-region 1,000-unit code and create a server-only key.
3. Pin current library versions after consulting authoritative docs.
4. Use owned/licensed source and garment images to execute one live Clothes V4 request through a minimal script.
5. Record a sanitized receipt and exact error behavior.
6. Confirm the cost endpoint/observed unit change for V4.

**Gate:** no full UI build until a live request succeeds or the exact external blocker is documented. Never fabricate a result.

### Slice 1 — Domain state machines and contracts

- session/proposal/task states;
- Consent Gate;
- role-safe DTOs;
- error taxonomy;
- idempotency fingerprint;
- unit ledger rules.

**Tests:** transition tables, blocked consent cases, expiry/revocation, duplicate generation.

### Slice 2 — Capability security and persistence

- migrations;
- hashed capability tokens;
- role middleware;
- encrypted provider identifiers;
- audit events;
- revocation.

**Tests:** cross-role access matrix and expired/revoked behavior.

### Slice 3 — YouCam production adapter

- in-memory image normalization;
- File API upload;
- V4 task create/status;
- strict multi-person flag;
- conservative polling/webhook verification;
- cost/budget handling;
- exact error mapping;
- deletion call.

**Tests:** fake-server contract tests plus a manually dispatched live smoke workflow.

### Slice 4 — Complete two-role experience

- create Try-On Pass;
- helper proposal flow;
- private wearer mirror;
- decision relay;
- SSE updates;
- expired/revoked/error states.

**Tests:** Playwright two-context journey and explicit negative authorization checks.

### Slice 5 — Design and accessibility polish

- intentional visual system;
- responsive 320–1920 px layout;
- reduced motion;
- keyboard flow;
- Axe scans;
- loading and failure UX;
- 404/expired/revoked pages.

### Slice 6 — Evidence, deployment, and judge mode

- durable HTTPS deployment and persistent DB;
- `/health` and `/meta` bound to commit SHA;
- deployment smoke receipt;
- split-role `/judge` tour;
- live receipt displayed safely;
- no-login demo.

### Slice 7 — Submission package

- comprehensive README;
- architecture SVG and PNG;
- four to six real screenshots;
- 1280×720 Devpost thumbnail;
- 2:15–2:40 public demo video script/storyboard;
- Devpost copy;
- license and asset attribution;
- final claims audit.

---

## 13. Test and evidence strategy

### 13.1 Unit tests

- session/proposal state transitions;
- Consent Gate decision table;
- idempotency fingerprint;
- token hashing and authorization;
- encryption round-trip and key-version failure;
- provider error mapping;
- unit reservation/commit/release;
- receipt redaction;
- safe-note validation;
- claims validator.

### 13.2 Integration tests

- API routes against isolated database;
- fake YouCam server for upload, create, poll, error, timeout, and deletion;
- two concurrent generation requests produce one provider task;
- SSE role filtering;
- revocation during processing;
- deletion partial failure.

### 13.3 E2E and accessibility

Run logical journeys across representative mobile, tablet, desktop, and high-contrast profiles:

1. wearer creates pass → helper proposes → wearer reviews → helper receives decision;
2. invalid/multi-person/photo-readiness error recovery;
3. expiry and revocation;
4. helper attempts private result access and receives 403/404 without leakage;
5. keyboard-only flow and Axe scans.

### 13.4 Live and deployment evidence

- live YouCam smoke is manually dispatched so it does not burn units on every CI run;
- receipt includes mode, API family, task state, redacted task fingerprint, timings, observed cost if available, image hashes—not images—and exact source commit;
- deployment smoke checks `/`, `/api/health`, `/api/meta`, seeded judge session, and protected route behavior;
- public endpoint must be durable through 20 November, not a local tunnel.

### 13.5 Completion contract

Do not call the project submission-ready until all are true:

- at least one successful live YouCam V4 receipt exists;
- P0 features work on the public deployment;
- helper cannot access wearer images in automated tests and manual network inspection;
- exact-sha CI is green;
- deployment smoke is green;
- repository is public and setup instructions were tested from a clean clone;
- public 1–3 minute video exists and matches deployed behavior;
- Devpost fields, screenshots, repository URL, demo URL, and video URL are complete;
- endpoint will stay available through judging.

---

## 14. Demo strategy

### 14.1 Demo thesis

The video should not tour every feature. It should prove one idea:

> Two people complete a useful shopping decision, but the helper never receives the wearer's image.

### 14.2 Target runtime: 2 minutes 25 seconds

| Time | Visual | Narration purpose |
|---|---|---|
| 0:00–0:12 | Messaging-style reenactment: “Send me a full-body photo” crossed out; WearerKey title appears | Establish the privacy problem. |
| 0:12–0:30 | Wearer creates Try-On Pass, allows `outer` and `upper_body`, selects one-hour expiry | Show consent as a product control. |
| 0:30–0:48 | Helper window opens; privacy panel explicitly shows “wearer photo: never shared” | Prove role separation. |
| 0:48–1:12 | Helper uploads owned jacket image and submits; Consent Gate passes | Explain YouCam File API + AI Clothes V4. |
| 1:12–1:33 | Task timeline moves through upload/processing; live receipt badge shows `LIVE_YOUCAM` | Prove non-trivial live integration. |
| 1:33–1:54 | Wearer privately sees the result, disclaimer, and selects Maybe with a note | Show the decisive private mirror. |
| 1:54–2:08 | Helper sees only “Maybe” and the note; network/visibility rail confirms no image | Deliver the wow moment. |
| 2:08–2:22 | Wearer revokes; deletion receipt reports exact provider/local status | Show lifecycle completeness. |
| 2:22–2:25 | Tagline and URLs | Close cleanly. |

Use only owned/licensed assets and royalty-free or original music. The video must be **publicly visible** per the rules, not private or unlisted.

### 14.3 Judge tour

The public `/judge` route should offer:

- “Open Wearer View” and “Open Helper View” buttons;
- a seeded recorded-live result with visible mode/evidence;
- one-click new live attempt if units remain;
- a 60-second guided checklist;
- architecture and privacy boundary diagram;
- exact limitations.

---

## 15. Submission strategy

### 15.1 Suggested Devpost title and tagline

**Title:** WearerKey  
**Tagline:** Private collaborative virtual try-on—shop together without sharing the wearer's photo.

### 15.2 Story structure

1. **Problem:** collaborative shopping currently distributes sensitive photos/screenshots.
2. **Insight:** the helper needs a decision, not access to the wearer's image.
3. **Solution:** a role-separated Try-On Pass and private YouCam mirror.
4. **Technical depth:** capability auth, consent state machine, V4 async integration, strict multi-person gate, cost/idempotency controls, deletion receipts.
5. **Impact:** assisted shopping, remote styling, friends, and gifting.
6. **Truthful limitations:** visual preview only; no size guarantee; live vs recorded/fixture modes labeled.
7. **Next:** retailer SDK, accessibility research, multi-helper sessions, and consent interoperability.

### 15.3 Required screenshots

1. Hero with the two-role value proposition.
2. Wearer consent/Try-On Pass creation.
3. Helper proposal screen with the explicit hidden-photo boundary.
4. Wearer-only private YouCam result.
5. Helper receiving only the decision.
6. Deletion/provider receipt and architecture diagram.

### 15.4 Thumbnail brief

- 1280×720 PNG.
- Left: helper holding a garment card; right: wearer mirror silhouette/result frame.
- A sealed relay line connects them; the source photo remains behind a visible privacy boundary.
- Text limited to `WearerKey` and `Shop together. Keep the photo private.`
- No sponsor logo unless official usage permission is confirmed.
- No fake UI or unsupported result imagery.

### 15.5 README must include

- one-sentence product value and real screenshot/GIF;
- public demo and judge-tour links;
- live/recorded/fixture mode definitions;
- 90-second local quick start;
- required environment variables without values;
- architecture diagram;
- exact YouCam workflow;
- privacy and trust boundaries;
- known limitations;
- test/CI commands and measured results generated from artifacts;
- asset licenses and prior-work disclosure;
- Devpost rules mapping;
- deletion behavior and data-retention table.

---

## 16. Risks and fallbacks

| Risk | Prevention | Truthful fallback |
|---|---|---|
| YouCam key/redeem code delayed | Obtain and test in Slice 0 | Continue UI/domain work, but mark `LIVE_PROVIDER_BLOCKED`; do not claim submission-ready. |
| Invalid source/garment inputs | Readiness coach and local validation | Show exact correction; keep owned known-good demo assets. |
| API task takes too long | Conservative poll, visible progress, timeout | Replay a recorded successful live result with receipt, labeled clearly. |
| Units exhausted | Cost check, max proposals, idempotency, cached recorded result | Judge replay remains usable; live button disabled with honest reason. |
| Deletion endpoint fails | Retry policy and provider receipt | Revoke local access immediately and show `PROVIDER_DELETION_FAILED/PENDING`. |
| Helper leaks private result through an endpoint | Role-safe DTOs, server proxy, negative tests | Fail closed; never ship until fixed. |
| Public host sleeps or expires | Use durable hosting and external uptime check | Maintain alternate deployment and update before deadline only. |
| Product appears too privacy-heavy like prior KeepMe | Emphasize two-party collaboration and decision relay, not identity repair | Demo the helper never seeing the result—this is the differentiator. |
| “Surprise gift” promise is misleading | Position Gift Mode as hiding sender/price/store, not garment | Use assisted-shopping story as primary narrative. |
| VTO interpreted as sizing | Prominent visual-preview disclaimer | Remove any copy implying fit, size, drape, or return guarantee. |
| Insufficient time | Freeze P2; deliver one flawless live flow | Do not add LLM, checkout, accounts, scraping, or multi-retailer catalog. |

---

## 17. Final coverage checklist

### Eligibility and access

- [ ] Entrant is personally eligible and registered.
- [ ] India-region YouCam account exists.
- [ ] Redeem code is applied and unit balance verified.
- [ ] Rising Star is selected only with truthful enrollment and school email evidence.

### Product and API

- [ ] Fresh repository created during the submission period.
- [ ] Live AI Clothes V4 integration succeeds.
- [ ] The YouCam API is central to the demonstrated value.
- [ ] `filter_multi_person: "strict"` is used.
- [ ] Provider mode is visible and truthful.
- [ ] Visual-preview limitation is explicit.
- [ ] Consent, revocation, and scoped deletion status work.

### Engineering

- [ ] Role boundary is server-enforced.
- [ ] Helper receives no source/result URL or bytes.
- [ ] Tokens are random, hashed, expiring, and revocable.
- [ ] Image metadata is stripped and raw bytes are not persisted.
- [ ] Unit ledger and idempotency prevent duplicate spend.
- [ ] Exact-sha CI and live/deployment receipts are green.
- [ ] Security scan finds no secrets in tree or history.
- [ ] Responsive, keyboard, and Axe gates pass.

### Repository and deployment

- [ ] Public repository includes source, assets, instructions, and license.
- [ ] Clean-clone setup was tested.
- [ ] Durable public HTTPS URL works without login or payment.
- [ ] Deployment remains available through 20 November 2026.
- [ ] README contains architecture, data lifecycle, limitations, and judge tour.

### Submission

- [ ] Devpost description is complete and evidence-bounded.
- [ ] Four to six real screenshots are uploaded.
- [ ] Public 1–3 minute YouTube/Vimeo video shows the running app and explains YouCam.
- [ ] Video contains no unauthorized trademarks, music, or assets.
- [ ] Repository, live demo, and video URLs have been tested in a private browser.
- [ ] Submission is entered before 2 November 2026, 11:45 a.m. EST.

---

## 18. Final build priority

If time becomes critically short, ship these in order:

1. successful live YouCam V4 call and receipt;
2. strict server-enforced two-role boundary;
3. one complete wearer → helper → wearer → helper flow;
4. durable public deployment and judge seed;
5. clear design, errors, and mobile responsiveness;
6. security/accessibility/claims tests;
7. README, screenshots, video, and Devpost package;
8. optional features only afterward.

The project wins on **clarity plus proof**, not on the number of APIs or screens.
