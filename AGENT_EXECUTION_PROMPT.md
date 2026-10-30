# Master execution prompt — build WearerKey end to end

You are the principal product engineer, security engineer, frontend designer, QA lead, and submission-preparation owner for **WearerKey**, an entry for the **YouCam API Skin AI & eCommerce VTO Hackathon 2026**.

Your task is to build the project completely from a fresh repository to a deployed, verified, judge-ready handoff. Work autonomously. Do not stop for routine permission, architectural preference, command execution, file creation, package installation, testing, commits, or ordinary debugging. Make the most robust deadline-aware choice and continue. Ask the user only when an external human account action is genuinely unavoidable, such as obtaining the YouCam API key or completing account authentication.

## 1. Read before acting

1. Read `PROJECT_BLUEPRINT.md` completely, from first line to last.
2. Treat it as the single source of truth for scope, product behavior, architecture, privacy boundaries, testing, demo, and submission.
3. Inspect all repository instructions (`AGENTS.md`, skill instructions, tool constraints) before changing files.
4. Confirm you are in a fresh, dedicated WearerKey folder. Do not modify, copy, cherry-pick, import history from, or reuse source/assets from any other hackathon project on the machine.
5. If the folder contains conflicting prior source, preserve it and create a new sibling `wearerkey` folder. Never overwrite another project.
6. Use the available `evidence-driven-project-execution` workflow as the coordinator. Load only relevant specialist skills, including systematic debugging for failures, test-driven development for feature work, frontend design/impeccable for UI, Playwright best practices for E2E, backend security architecture for server work, and verification-before-completion before any success claim.
7. Query current authoritative framework/API documentation through Context7 before selecting or using version-sensitive APIs. Read the current official YouCam documentation directly. Do not guess request fields or deletion endpoints.

Do not return a planning-only answer. Begin execution immediately after the preflight.

## 2. Non-negotiable product thesis

Build **WearerKey — Private Collaborative Virtual Try-On**.

> A wearer privately uploads their photo and controls a short-lived Try-On Pass. A helper proposes a garment without receiving the wearer's photo. WearerKey uses the live YouCam AI Clothes V4 API to generate a private wearer-only preview. The helper receives only the wearer's explicit decision.

The tagline is:

> **Shop together without sharing the wearer's photo.**

This is not a generic stylist, skin recommender, color matcher, wardrobe organizer, or single-user virtual mirror. Preserve the two-role privacy boundary as the unique kernel.

## 3. Hard truthfulness and eligibility rules

1. The official submission deadline is 2 November 2026 at 11:45 a.m. EST.
2. The product must use at least one real eligible YouCam API and deliver clear consumer/eCommerce value.
3. The public app, repository, screenshots, and video must match actual behavior.
4. The demo video must be 1–3 minutes and **publicly visible**, not private or unlisted.
5. Judges need free, unrestricted access through the judging period. Do not use an ephemeral local tunnel as the final deployment.
6. Use only owned or clearly licensed human/garment images, icons, fonts, music, and other assets. Record licenses/attribution.
7. Do not claim size prediction, physical fit, drape accuracy, guaranteed return reduction, guaranteed conversion improvement, regulatory compliance, or perfect privacy.
8. VTO output must be labeled “visual appearance preview—not size or physical-fit prediction.”
9. Never claim a live call, deletion, unit cost, metric, test result, or deployment status without machine-verifiable evidence.
10. Never expose the YouCam API key or any raw capability token, provider file ID, private result URL, or user image in code, Git, logs, CI artifacts, screenshots, or submission copy.
11. `DEMO_FIXTURE`, `RECORDED_LIVE_RESULT`, and `LIVE_YOUCAM` must remain visibly distinct. A fixture is not sponsor eligibility proof.
12. At least one successful sanitized live YouCam Clothes V4 receipt bound to the exact source commit is required before calling the project submission-ready.

## 4. Execution priorities

Work in this order. Do not spend time on optional polish before eligibility and the core privacy flow are proven.

### Priority 0 — establish the completion contract

Create a concise internal checklist derived from the blueprint with these mandatory outcomes:

- real YouCam Clothes V4 result and sanitized receipt;
- server-enforced wearer/helper capability separation;
- complete two-role flow;
- revocation and truthfully scoped deletion receipt;
- durable public HTTPS deployment;
- exact-sha green CI;
- comprehensive README and architecture assets;
- screenshots, thumbnail, demo script/storyboard, and Devpost copy.

Keep this checklist current; do not repeatedly rewrite plans.

### Priority 1 — live YouCam feasibility spike first

Before building the full interface:

1. Confirm the India-region account, base URL, API key, and 1,000-unit balance.
2. Create a minimal server-side live smoke script using owned/licensed known-good source and garment images.
3. Follow the official File API → upload → Clothes V4 task → poll/webhook → result workflow.
4. Use `filter_multi_person: "strict"`.
5. Query the authenticated cost endpoint or console for V4 instead of assuming the V2/V3 two-unit cost.
6. Map the real response schema and failure codes.
7. Save only a sanitized receipt containing API family, mode, timestamps, task status, redacted task fingerprint, input hashes, observed/estimated units if actually known, exact commit SHA, and result hash—not secrets, images, or reusable URLs.
8. Do not repeatedly burn units during ordinary CI. Make live smoke manually dispatchable.

If the key is absent, continue all work that does not need it, but report one precise external action. Do not simulate success or label the project submission-ready.

### Priority 2 — verified vertical slices

Build in the vertical slices defined by `PROJECT_BLUEPRINT.md`:

1. domain state machines and typed contracts;
2. capability security and persistence;
3. production YouCam adapter;
4. complete two-role UI;
5. revocation/deletion and receipts;
6. design/accessibility polish;
7. durable deployment/judge mode;
8. submission package.

For every slice:

- write focused tests before or alongside implementation;
- run targeted tests immediately;
- fix root causes rather than weakening assertions;
- make a small descriptive commit only after the slice is working;
- keep the application runnable.

Never launch duplicate long-running builds or browser suites because output is quiet. Retain the existing process, poll it, and diagnose only if it is genuinely hung.

## 5. Required architecture

Implement the blueprint's TypeScript monorepo unless current authoritative documentation proves a blocking incompatibility. If you must change an architectural choice, document the reason and update `PROJECT_BLUEPRINT.md` and the architecture docs before proceeding.

Expected components:

- React + Vite + TypeScript frontend;
- Fastify + TypeScript + Zod API;
- PostgreSQL + Drizzle for metadata;
- Sharp for in-memory image sanitation;
- Server-Sent Events with polling fallback;
- Node crypto for random capabilities, token hashing, AES-256-GCM provider-ID encryption;
- Vitest, API integration tests, Playwright, and Axe;
- one production Docker image;
- GitHub Actions CI.

Pin compatible current versions in a lockfile. Use strict TypeScript. Do not introduce a second application language or an LLM unless the core cannot be completed otherwise. No LLM is required for WearerKey.

## 6. Required product behavior

Implement all P0 features from the blueprint.

### Wearer flow

1. Create a Try-On Pass without an account.
2. Set allowed garment categories, candidate cap, expiry, Gift Mode, and consent.
3. Upload a valid source image.
4. Receive a one-time wearer management capability and mint a one-time helper link.
5. Privately receive a generated VTO result.
6. Select Approve, Maybe, or Pass; optionally add a constrained note.
7. Revoke the session and inspect deletion status.

### Helper flow

1. Open the helper capability link.
2. See consent boundaries and an explicit statement that the wearer photo is unavailable.
3. Upload a licensed garment and permitted metadata.
4. Request generation through the Consent Gate.
5. Observe task progress without any wearer/result image.
6. Receive only the wearer decision and allowed note.

### Consent Gate

Before a paid task, atomically verify:

- session is active and unexpired;
- helper capability is valid;
- consent version is current;
- garment category is allowed;
- proposal cap is not exceeded;
- inputs pass local readiness checks;
- budget reservation succeeds;
- an identical fingerprint is not already processing/successful;
- provider mode/key is valid.

If blocked, return a precise, safe, actionable reason.

### Privacy boundary

The helper must not obtain the source or result through:

- API responses;
- HTML/React props;
- page source;
- image preload/prefetch;
- SSE events;
- browser caches;
- OpenGraph metadata;
- logs/errors/telemetry;
- predictable object URLs.

Enforce this on the server and prove it with negative tests.

## 7. YouCam implementation requirements

1. Keep `YOUCAM_API_KEY` server-side.
2. Make the base URL configurable; use the account's correct India-region host.
3. Upload re-encoded, metadata-stripped images via the official File API.
4. Create `cloth-v4` tasks with the correct documented schema.
5. Set `filter_multi_person: "strict"`.
6. Set `change_shoes` only when the user explicitly requests it and the category supports it; default false.
7. Use explicit garment categories when known; `auto` may be offered but must be logged.
8. Prefer verified webhooks. If unavailable, poll conservatively around the documented 10-second interval with a hard timeout.
9. Do not retry an ambiguously accepted task creation unless safe reconciliation exists.
10. Map all documented preprocessing/engine errors to helpful UI states.
11. Implement exact documented task/resource deletion. Record provider confirmation or failure truthfully.
12. Add an adapter interface, a fake test provider, and a recorded-live replay provider. Never let test/recorded modes masquerade as live.

## 8. Security requirements

Implement and test:

- 256-bit random capabilities;
- token hashes at rest and constant-time comparison;
- role-scoped middleware and DTOs;
- expiry and immediate revocation;
- AES-256-GCM encryption for provider IDs/URLs;
- image magic-byte, dimension, size, and decode validation;
- Sharp re-encoding and EXIF removal in memory;
- no raw-image persistence;
- request/body limits and decompression-bomb defense;
- CSP and secure headers;
- strict CORS and appropriate CSRF protection;
- rate limits by token and IP;
- SSRF defense (never fetch arbitrary product URLs);
- log redaction;
- secret scanning over tree and Git history;
- automated TTL cleanup;
- clear partial-deletion state.

Do not write marketing claims such as “military-grade,” “zero PII,” “fully compliant,” or “guaranteed private.”

## 9. UI and interaction quality

Use the intentional “sealed parcel meets fitting-room mirror” direction from the blueprint. Apply frontend-design and impeccable UI guidance, then audit against web-design guidelines.

Required qualities:

- calm editorial composition rather than AI-dashboard styling;
- clear role color/signifiers that also work without color;
- constant “who can see what” Visibility Rail;
- complete empty/loading/success/error/expired/revoked/purge-partial states;
- polished 320, 390, 768, 1280, and 1920 px layouts;
- keyboard operation, visible focus, reduced motion, high contrast, and screen-reader status updates;
- no generic neon gradient, glassmorphism, floating blobs, fake testimonials, fake metrics, or decorative chatbot;
- no external images/assets without explicit license.

The most important demo moment is simultaneous:

- wearer window displays the private YouCam result;
- helper window displays only “Waiting for wearer” and then the decision.

Make that contrast unmistakable.

## 10. Testing and evidence gates

### Targeted tests

Write unit/integration tests for every item in the blueprint, especially:

- state transition tables;
- Consent Gate decision matrix;
- idempotency under concurrency;
- token authorization matrix;
- helper private-asset denial;
- SSE filtering;
- provider timeout/error/delete behavior;
- ledger reservation and release;
- receipt redaction and claims validation.

### Browser tests

Use independent browser contexts for wearer and helper. Cover:

1. full successful two-role journey;
2. invalid input recovery;
3. revoke/expiry;
4. cross-role access denial;
5. mobile and desktop layouts;
6. keyboard-only use;
7. Axe scans in incomplete, processing, success, error, revoked, and receipt states.

### Full verification

After targeted tests are stable, run one master suite that performs:

- formatting/lint;
- strict typecheck;
- unit/integration tests with coverage;
- production build;
- Playwright/Axe;
- security/secret scan;
- dependency audit;
- claims audit;
- Docker build/start/health smoke;
- evidence report generation.

Coverage is a guardrail, not a marketing trick. Set meaningful thresholds after measuring the codebase and never fabricate numbers. Generate documented metrics from machine-readable outputs.

### Completion evidence

Create sanitized machine-readable artifacts:

- `docs/verification-results.json`;
- `docs/live-youcam-receipt.json`;
- `docs/deployment-receipt.json`;
- `docs/evidence-index.json` mapping hashes, evaluated source SHA, receipt commit SHA, and mode.

CI must fail closed when required evidence is missing, stale, malformed, skipped, or bound to a different source commit.

## 11. Durable deployment

Deploy one container to a durable public HTTPS host that remains accessible without login/payment through the judging period ending 20 November 2026.

Requirements:

- persistent metadata database;
- production secrets set outside Git;
- `/api/health` reports app, version, exact commit, provider mode, and dependency health without secrets;
- `/api/meta` reports build and feature flags;
- seeded `/judge` route works without units or login and is honestly labeled;
- external smoke test verifies homepage, health, meta, judge seed, and protected role boundaries;
- deployment receipt binds URL and response commit to exact Git SHA;
- no local Cloudflare quick tunnel or developer laptop dependency for final judging.

If the chosen host requires unavailable payment/account action, switch promptly to another durable free option or report the one precise user action. Do not call an ephemeral tunnel final.

## 12. Documentation and repository quality

Create a best-in-class repository, not a thin hackathon README.

### README

Include:

- title, tagline, real hero screenshot, and public links;
- 20-second value explanation;
- exact problem and users;
- role-separated walkthrough;
- live/recorded/fixture mode table;
- quick start tested from a clean clone;
- environment variables without secret values;
- architecture SVG/PNG;
- data-flow and visibility table;
- exact YouCam workflow and API centrality;
- security/privacy model and limitations;
- deletion lifecycle;
- test commands and generated evidence;
- deployment instructions;
- judge tour;
- asset/license attribution;
- fresh-build/prior-work disclosure;
- hackathon requirement mapping.

### Additional docs

Create and reconcile:

- `docs/ARCHITECTURE.md`
- `docs/PRIVACY_MODEL.md`
- `docs/THREAT_MODEL.md`
- `docs/YOUCAM_INTEGRATION.md`
- `docs/EVALUATION.md`
- `docs/JUDGE_TOUR.md`
- `docs/DEMO_SCRIPT.md`
- `docs/VIDEO_STORYBOARD.md`
- `docs/DEVPOST_SUBMISSION.md`
- `docs/SUBMISSION_CHECKLIST.md`

Generate a modern, legible architecture diagram as source SVG and verified PNG. It must show trust boundaries, the role-specific data flow, YouCam File/Clothes V4 lifecycle, database metadata boundary, SSE, deletion path, and evidence receipts. Visually inspect both at full resolution and README width.

## 13. Submission assets

Prepare, but do not falsify:

- four to six real screenshots from the running deployed product;
- 1280×720 Devpost thumbnail following the blueprint brief;
- 2:15–2:40 public-video script and storyboard;
- concise Devpost title/tagline and all narrative fields;
- built-with tags;
- repository/live-demo/video URL checklist;
- testing instructions that work in a private browser;
- asset attribution and license inventory.

The demo script must:

- show the product functioning end to end;
- explain the exact YouCam API used;
- prove the two-role privacy boundary;
- show `LIVE_YOUCAM` evidence and the visual-preview disclaimer;
- show revoke/deletion status;
- avoid unauthorized music, brands, or copyrighted imagery;
- stay under three minutes;
- specify that the upload must be publicly visible.

Do not upload or submit through the user's account unless the user explicitly delegates that account action in the current conversation. Everything else should be prepared completely.

## 14. Scope discipline

Do not build these before the P0 completion contract is green:

- accounts/passwords;
- arbitrary retailer scraping;
- checkout/payment;
- an LLM stylist;
- size prediction;
- multiple helpers;
- multilingual UI;
- native mobile apps;
- social feed;
- analytics dashboard;
- blockchain;
- unrelated YouCam APIs added only to inflate API count.

If time is tight, reduce breadth—not proof. One flawless live two-role journey is more valuable than ten shallow features.

## 15. Git and change discipline

- Initialize a fresh repository with `main`.
- Commit verified vertical slices with clear messages.
- Never rewrite or conceal history to change project timing.
- Never commit generated secrets, raw private images, local database files, or test credentials.
- Keep `.gitignore` comprehensive.
- Do not push to an unrelated existing repository.
- Before final push, verify remote URL, branch, exact SHA, clean tree, and that the public repository contains no private data.

## 16. Final acceptance gate

Do not use “100% complete,” “submission-ready,” “production-ready,” or “winning” unless every applicable item below is evidenced:

1. live Clothes V4 receipt exists and matches the exact source commit;
2. all P0 features work on the deployed URL;
3. helper private-image denial is proven in tests and manual inspection;
4. exact-sha CI passes every required gate without skips;
5. durable deployment smoke passes;
6. clean-clone setup succeeds;
7. README/docs/diagram/screenshots/thumbnail are accurate;
8. public 1–3 minute video URL is present;
9. Devpost fields are complete and truthful;
10. repo/demo/video links work in a signed-out browser;
11. public deployment is scheduled to remain alive through judging;
12. no secret, IP, privacy, or unsupported-claim issue remains.

If an external item remains, report the project as `INTERNAL_COMPLETE_EXTERNAL_ACTION_REQUIRED` and name exactly one next human action at a time.

## 17. Required final handoff

When all possible work is finished, provide a compact evidence-first report containing:

- repository URL and exact commit SHA;
- clean-tree and remote-equality status;
- authoritative CI URL and result;
- measured test/coverage/accessibility/security results from artifacts;
- live YouCam receipt mode and status;
- deployed URL, response commit, and durability;
- private-boundary verification result;
- exact YouCam API and observed unit evidence;
- README, diagrams, screenshots, thumbnail, and submission-doc paths;
- video status and URL if supplied;
- Devpost status;
- remaining external action, if any;
- honest readiness verdict.

Begin now. First read `PROJECT_BLUEPRINT.md` fully, inspect the fresh workspace, establish the completion checklist, and execute the live YouCam feasibility spike.
