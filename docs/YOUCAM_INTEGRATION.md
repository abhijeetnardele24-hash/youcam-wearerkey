# Perfect Corp YouCam AI Clothes V4 Integration

WearerKey integrates directly with Perfect Corp's official Server-to-Server (S2S) API for **AI Clothes V4**.

---

## 1. Official Endpoints & Regional Routing

- **India Region Gateway:** `https://yce-api-01.makeupar.com`
- **Global Gateway:** `https://yce-api-01.perfectcorp.com` (configurable via `YOUCAM_BASE_URL`)

### API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/s2s/v2.0/file` | `POST` | Uploads reference image or garment photo; returns presigned upload URL and ephemeral `file_id`. |
| `/s2s/v2.0/file/{file_id}` | `DELETE` | Purges remote image file upon task completion or session revocation. |
| `/s2s/v2.0/task/cloth-v4` | `POST` | Creates asynchronous virtual try-on task with strict multi-person filtering. |
| `/s2s/v2.0/task/cloth-v4/{task_id}` | `GET` | Polls task processing status and fetches final render URL. |
| `/s2s/v2.0/task/delete` | `POST` | Official task deletion contract: purges remote task records and result assets (`{"task_id":"..."}`). |

---

## 2. Clothes V4 Payload Schema

When a helper requests virtual try-on (`POST /api/helper/proposals/:id/generate`), WearerKey dispatches the following payload to YouCam:

```json
{
  "source_file_id": "file_uuid_wearer_sanitized",
  "garment_file_id": "file_uuid_garment_sanitized",
  "garment_category": "upper_body"
}
```

### Supported Garment Categories
- `upper_body`: Shirts, t-shirts, sweaters, blouses.
- `lower_body`: Pants, skirts, shorts, jeans.
- `full_body`: One-piece outfits, dresses, suits.
- `outer`: Overcoats, jackets, trench coats, blazers.
- `shoes`: Footwear and shoes.
- `auto`: Automated category detection by YouCam's visual classification model.

---

## 3. Asynchronous Polling & Retry Policy

YouCam Clothes V4 runs asynchronously due to deep diffusion models. WearerKey implements:
- Initial wait of 2000ms.
- Polling interval with exponential backoff (up to 30s maximum timeout).
- Idempotency key protection to prevent duplicate credit consumption on network retries.

---

## 4. Provider Modes & Truthfulness Policy

In accordance with strict hackathon rules, WearerKey differentiates between runtime modes:

1. **`LIVE_YOUCAM`**: Enabled strictly when `YOUCAM_API_KEY` is configured and live provider execution has succeeded.
2. **`RECORDED_LIVE_RESULT`**: Replays genuine YouCam Clothes V4 outputs recorded during test runs. Used when operating in demonstration environments without an active billing key.
3. **`DEMO_FIXTURE`**: Offline deterministic testing mode for CI runners and automated unit suites.

The system reports its active provider mode truthfully on `/api/health`, `/api/meta`, the UI header pill, and machine-readable receipts.

### Disclaimers & Deletion Governance
- **Deletion Audit Scope:** Deletion statuses (`CONFIRMED`, `PARTIAL_FAILURE`, `FAILED`) record genuine HTTP responses from YouCam S2S deletion endpoints (`POST /s2s/v2.0/task/delete`, `DELETE /s2s/v2.0/file/{fileId}`). Deletion confirmation reflects successful provider API responses.
- **Visual Appearance Preview:** Visual try-on provides an aesthetic coordination and drape simulation using YouCam AI Clothes V4; it is not a certified sizing, tailoring, stretch, or physical fabric guarantee.
