# WearerKey — Official Video Demo Storyboard & Narration Script

**Target Duration:** 2 minutes 45 seconds (1–3 minute limit)  
**Platform & Visibility:** Publicly visible on YouTube or Vimeo (Strictly Public — NOT Private, NOT Unlisted)  
**Resolution:** 1080p 60fps  
**Audio:** Clear voiceover with subtle background score  
**Key Feature Demonstrated:** Collaborative shopping with server-enforced photo protection powered by YouCam AI Clothes V4.

---

## Scene 1: The Problem Thesis (0:00 - 0:25)

### Visuals
- Screen begins on standard messaging apps where friends awkwardly send personal mirror selfies asking: *"Does this coat look good on me?"*
- Red highlight box animates around the personal photo.
- Cut to WearerKey landing page: **"Shop together without sharing the wearer's photo."**
- Emphasize the core dilemma: shoppers want honest fashion advice from friends, but contemporary VTO tools force them to expose personal body photos.

### Voiceover / Audio
> "When shopping online, getting advice from friends or a stylist is natural. But current virtual try-on tools force an uncomfortable trade-off: to see how clothes look on you, you have to text your private full-body photo or screenshots to another person.  
> WearerKey solves this with a role-separated privacy relay protocol built on Perfect Corp's YouCam AI Clothes V4 engine."

---

## Scene 2: The Wearer Experience & Consent Seal (0:25 - 0:50)

### Visuals
- User clicks **"Create Try-On Pass"**.
- Shows selecting permitted categories: **"Outerwear"** and **"Upper Body"**.
- Shows setting candidate cap to 3 proposals, 24-hour expiration.
- User uploads reference photo (or clicks "Use Sample Silhouette").
- Visual indicator showing server-side sanitization: camera and EXIF data stripped in memory before provider transmission.
- The **Consent Seal** is minted, and a secure **Helper Link** is copied.

### Voiceover / Audio
> "The wearer initiates a session by defining an immutable Consent Seal. They choose exactly which clothing categories their shopping companion is permitted to propose, set a proposal limit, and upload their private reference photo.  
> EXIF and location metadata are stripped server-side in memory before provider transmission. The wearer then copies a scoped Helper Link."

---

## Scene 3: The Helper Perspective & Server-Enforced Boundary (0:50 - 1:20)

### Visuals
- Split-screen or browser window switch to the **Helper Room** (`/helper`).
- Show the Helper interface: permitted categories are clearly visible.
- Highlight the **Privacy Guard Banner**: *"Wearer Photo: Protected (Never Shared)"*.
- Helper pastes a product link for a *"Tailored Camel Wool Overcoat"* and uploads a garment image.
- Helper clicks **"Submit Proposal"**.
- Open Chrome DevTools (`Network` tab) on the Helper pane to visually prove: **0 bytes of wearer image or result image exist in any helper response**.

### Voiceover / Audio
> "Now look at the helper's screen. The helper sees only the allowed categories and proposal tools.  
> Notice that the wearer's reference photo is completely absent. Even inspecting the helper's network traffic reveals zero image bytes or stream URLs. The privacy boundary is strictly enforced by the server."

---

## Scene 4: YouCam AI Clothes V4 Virtual Try-On (1:20 - 1:55)

### Visuals
- Transition back to the **Wearer Control Room** (`/wearer`).
- Live SSE update signals: *"New proposal submitted: Tailored Camel Wool Overcoat"*.
- Wearer clicks into their **Private Mirror**.
- Show the YouCam AI Clothes V4 rendering: clean garment drape and realistic folds over the wearer silhouette.
- Wearer evaluates the aesthetic visual drape privately (noting the appearance preview disclaimer).
- Wearer clicks **"Approve"** on the Decision Slip, adds a safe note: *"Love the drape, ordering medium"*, and submits.

### Voiceover / Audio
> "In the wearer's private room, the new proposal appears instantly. The server orchestrates YouCam's official Clothes V4 API using asynchronous polling and exponential backoff.  
> The resulting appearance preview appears exclusively in the wearer's private mirror. The wearer approves the coat and leaves a safe styling note."

---

## Scene 5: Wearer Revocation & Signed Audit Receipt (1:55 - 2:20)

### Visuals
- Helper room updates: receives the **Approve** badge and wearer note, but still zero images.
- Wearer clicks **"Revoke Pass & Purge Session"**.
- Confirmation modal opens, wearer confirms.
- Show the generated **Tamper-Evident Deletion Receipt v2.0**.
- Point out: `overall_deletion_status: CONFIRMED`, and the cryptographic `receipt_hmac` signature.
- Click **"Verify Receipt"** to show constant-time HMAC-SHA256 validation.

### Voiceover / Audio
> "The helper immediately gets the styling decision they need to help make the purchase.  
> When the shopping session ends, the wearer revokes the pass with one click. WearerKey automatically purges in-memory buffers and executes deletion requests against upstream YouCam tasks and files, producing an application-signed HMAC audit receipt that records provider deletion responses."

---

## Scene 6: The 30-Second Judge Tour & Conclusion (2:20 - 2:45)

### Visuals
- Navigate to **`/judge`**.
- Click **"Launch Interactive Split-Screen"**.
- Show both Wearer and Helper perspectives operating side-by-side in real time.
- Display terminal showing green CI test suite: 70 Vitest unit+integration tests and 10 Playwright browser tests passing, 0 Axe accessibility violations in tested states.
- Closing title card: **WearerKey — Private Collaborative Virtual Try-On**.
- Links to GitHub repo and YouCam integration docs.

### Voiceover / Audio
> "Hackathon judges can test both roles side-by-side in under 30 seconds using our pre-seeded judge tour at `/judge`.  
> WearerKey is backed by 70 Vitest tests, 10 Playwright browser tests, 0 Axe accessibility violations in tested states, and zero fabricated claims. Thank you."
