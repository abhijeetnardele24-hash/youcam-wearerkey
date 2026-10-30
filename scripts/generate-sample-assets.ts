import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

async function main() {
  const dir = path.resolve(process.cwd(), "apps/api/public");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. Reference photo: 600x800 silhouette
  const refSvg = Buffer.from(`<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="800" fill="#F5F0E7"/>
    <rect x="20" y="20" width="560" height="760" fill="#EBE3D3" rx="8"/>
    <circle cx="300" cy="220" r="80" fill="#1F624F"/>
    <path d="M 210 320 L 390 320 L 420 580 L 180 580 Z" fill="#1F624F"/>
    <rect x="225" y="580" width="65" height="160" fill="#1F624F"/>
    <rect x="310" y="580" width="65" height="160" fill="#1F624F"/>
    <text x="300" y="460" font-family="sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Wearer Silhouette</text>
  </svg>`);
  await sharp(refSvg).png().toFile(path.join(dir, "sample_wearer_reference.png"));

  // 2. Garment photo: 500x500 overcoat
  const garmentSvg = Buffer.from(`<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
    <rect width="500" height="500" fill="#FAF7F2"/>
    <path d="M 140 100 L 360 100 L 430 210 L 370 250 L 340 190 L 350 430 L 150 430 L 160 190 L 130 250 L 70 210 Z" fill="#70465E"/>
    <path d="M 250 100 L 210 240 L 250 260 L 290 240 Z" fill="#4F3142"/>
    <text x="250" y="360" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Tailored Wool Overcoat</text>
  </svg>`);
  await sharp(garmentSvg).png().toFile(path.join(dir, "sample_garment_overcoat.png"));

  // 3. Virtual try-on result: 600x800 composed try-on
  const vtoSvg = Buffer.from(`<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="800" fill="#F5F0E7"/>
    <rect x="20" y="20" width="560" height="760" fill="#EBE3D3" rx="8"/>
    <circle cx="300" cy="220" r="80" fill="#1F624F"/>
    <!-- Draped garment over torso -->
    <path d="M 190 320 L 410 320 L 435 590 L 165 590 Z" fill="#70465E"/>
    <path d="M 300 320 L 260 460 L 300 480 L 340 460 Z" fill="#4F3142"/>
    <rect x="225" y="590" width="65" height="150" fill="#1F624F"/>
    <rect x="310" y="590" width="65" height="150" fill="#1F624F"/>
    <text x="300" y="540" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">YouCam Clothes V4 Try-On</text>
    <!-- Watermark banner -->
    <rect x="40" y="720" width="520" height="36" rx="4" fill="#15201D" fill-opacity="0.85"/>
    <text x="300" y="743" font-family="sans-serif" font-size="11" font-weight="bold" fill="#FAF7F2" text-anchor="middle">VISUAL APPEARANCE PREVIEW ONLY — NOT AN EXACT SIZE GUARANTEE</text>
  </svg>`);
  await sharp(vtoSvg).png().toFile(path.join(dir, "sample_vto_result.png"));

  console.log("Successfully generated sample assets in apps/api/public!");
}

main().catch((err) => {
  console.error("Asset generation error:", err);
  process.exit(1);
});
