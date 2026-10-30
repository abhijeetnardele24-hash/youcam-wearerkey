# WearerKey — 30-Second Judge Tour Guide

Welcome hackathon judges! This guide enables you to verify the entire WearerKey two-role collaborative protocol and its server-enforced privacy boundary in **under 30 seconds**.

---

## Quick Evaluation Steps

### 1. Launch the Guided Split-Screen Demo
1. Open the running application at `http://localhost:3000` (or the deployed public URL).
2. Click **"Judge Tour"** in the top navigation bar (or navigate directly to **`/judge`**).
3. Click **"Launch Interactive Split-Screen"**.

---

## 2. What to Inspect in the Split View

Once launched, you will see two synchronized viewports representing the two roles:

### Left Viewport — Role A: Private Wearer
- **Private Fitting Mirror:** Displays the wearer's full reference silhouette and the generated **YouCam AI Clothes V4** virtual try-on render.
- **Watermark Disclaimer:** Confirms responsible AI disclosure (*"VISUAL APPEARANCE PREVIEW ONLY"*).
- **Decision Slip:** Allows the wearer to cast their verdict (**Approve / Maybe / Pass**) with an optional safe feedback note.
- **Pass Revocation:** A button to immediately purge all active session data.

### Right Viewport — Role B: Shopping Companion / Stylist
- **Zero Photo Access:** Displays the uploaded garment proposal and the wearer's feedback verdict.
- **Strict Architectural Wall:** Notice that the helper viewport contains **NO wearer photos, NO try-on renders, and NO private body pixels**.
- **Permitted Categories:** Enforced by the server Consent Gate (e.g., only tops or outerwear).

---

## 3. Verify the Network Privacy Boundary (DevTools)

To verify the cryptographic guarantee for yourself:
1. Open your browser's Developer Tools (`F12` or `Ctrl+Shift+I`).
2. Select the **Network** tab.
3. In the Helper viewport, propose a new garment or refresh the helper workspace.
4. Filter by `Fetch/XHR` or `Img`.
5. **Notice:**
   - The helper requests only `GET /api/helper/session`.
   - Inspect the response JSON: `source_file_id`, `result_url`, and raw image buffers are **strictly absent** from the schema (`wearer_photo_status: "PROTECTED_NOT_SHARED"`).
   - Only the Wearer's session (`GET /api/wearer/session` and `GET /api/wearer/proposals/:id/result`) has access to visual try-on bytes.

---

## 4. Cryptographic Deletion Audit
Click **"Audit Receipt"** in either room or navigate to `/receipt/{token}` to inspect the signed machine-verifiable JSON audit receipt, showing timestamps, task counts, and Git commit SHA.
