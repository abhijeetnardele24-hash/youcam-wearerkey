# WearerKey Demo Video Script (Target: 2 Minutes)

A structured, conversational walkthrough for recording the hackathon demo video.

---

### [0:00 - 0:25] The Problem & The Thesis
- **Visual:** Speaker or title slide showing `docs/assets/wearerkey-thumbnail.svg`.
- **Narration:**
  > "Collaborative shopping is something we all do: we ask friends, partners, or stylists for advice before buying clothes online.
  > But virtual try-on tools force an uncomfortable trade-off: to see if an outfit works on you, you have to share your body photo with someone else.
  > WearerKey solves this. Powered by Perfect Corp's YouCam AI Clothes V4, WearerKey lets you shop together without sharing the wearer's photo."

---

### [0:25 - 0:55] Role A: Creating the Private Try-On Pass
- **Visual:** Navigate to `http://localhost:3000/create`.
- **Narration:**
  > "As the wearer, I start by creating a Try-On Pass. I select the permitted garment categories—let's say Tops and Outerwear—set a proposal limit of 5 items, and upload my reference photo.
  > This photo stays strictly private. Before anything is processed, metadata is stripped in memory via Sharp, and an encrypted capability token is minted."

---

### [0:55 - 1:25] Role B: The Role-Separated Helper Experience
- **Visual:** Open the Helper Link (`/helper/:token`) in an incognito window or split view.
- **Narration:**
  > "Now I send this helper link to my friend or stylist. Look at their screen:
  > The helper sees the approved categories and their remaining proposal budget, but there is zero access to my body photo.
  > The helper finds a jacket online, uploads the product image, and clicks 'Request YouCam Try-On'.
  > Under the hood, WearerKey orchestrates the YouCam Clothes V4 API asynchronously."

---

### [1:25 - 1:45] The Decisive Fitting Moment
- **Visual:** Switch back to Wearer Room (`/wearer/:token`).
- **Narration:**
  > "Instantly in my private mirror, the YouCam AI Clothes V4 render appears with a responsible AI visual disclaimer.
  > I can compare it side-by-side with my original silhouette.
  > I love this jacket, so I mark it 'Approve' and add a quick note: 'Great fit and color'.
  > When I submit, the helper only sees my verdict slip—they never see the photo."

---

### [1:45 - 2:00] Deletion & Conclusion
- **Visual:** Click "Audit Receipt" (`/receipt/:token`).
- **Narration:**
  > "When we're done, clicking revoke deletes the session and requests immediate deletion of remote provider files, generating a machine-verifiable audit receipt.
  > WearerKey: private, collaborative virtual try-on for the next generation of e-commerce. Thank you!"
