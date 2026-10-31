import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

async function main() {
  const svgPath = path.resolve("docs/assets/wearerkey-thumbnail.svg");
  const pngPath = path.resolve("docs/assets/wearerkey-devpost-thumbnail.png");

  if (fs.existsSync(svgPath)) {
    const svgBuffer = fs.readFileSync(svgPath);
    await sharp(svgBuffer)
      .resize(1280, 720)
      .png({ quality: 95 })
      .toFile(pngPath);
    console.log(`Generated thumbnail: ${pngPath} (${fs.statSync(pngPath).size} bytes)`);
  }

  const archSvgPath = path.resolve("docs/assets/architecture-diagram.svg");
  const archPngPath = path.resolve("docs/assets/architecture-diagram.png");
  if (fs.existsSync(archSvgPath)) {
    const archSvg = fs.readFileSync(archSvgPath);
    await sharp(archSvg)
      .png({ quality: 95 })
      .toFile(archPngPath);
    console.log(`Generated architecture PNG: ${archPngPath} (${fs.statSync(archPngPath).size} bytes)`);
  }
}

main().catch((err) => {
  console.error("Failed to generate assets:", err);
  process.exit(1);
});
