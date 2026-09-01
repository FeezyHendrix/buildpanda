// Regenerates the launcher icons and splash artwork from the canonical
// BuildPanda logo in packages/frontend. Run with `node scripts/generate-app-icons.mjs`
// whenever the brand mark changes, rather than hand-editing the PNGs.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const images = path.join(here, "..", "assets", "images");
const logoSvg = path.join(here, "..", "..", "frontend", "src", "assets", "images", "logo.svg");

const BRAND = "#004DE7";
const WORDMARK_ANCHOR = "M34.6958";

const source = readFileSync(logoSvg, "utf8");
const paths = source.match(/<path[^>]*\/>/g) ?? [];
if (paths.length === 0) throw new Error("no paths found in logo.svg");

// The logo is one file: the stacked-sheets mark sits left of x=34.7, the
// "BuildPanda" wordmark to its right. Splitting there gives a square-able mark
// for the launcher icon and the full lockup for the splash.
const splitAt = paths.findIndex((p) => p.includes(WORDMARK_ANCHOR));
if (splitAt <= 0) throw new Error("could not locate the wordmark anchor in logo.svg");
const markPaths = paths.slice(0, splitAt);

const white = (svg) => svg.replaceAll(BRAND, "#FFFFFF");

const markSvg = (fill) =>
  white(`<svg width="290" height="360" viewBox="0 0 29 36" xmlns="http://www.w3.org/2000/svg">${markPaths.join("")}</svg>`)
    .replaceAll("#FFFFFF", fill);

const lockupSvg = (fill) => white(source).replaceAll("#FFFFFF", fill);

async function renderCentred({ svg, canvas, markRatio, background, out }) {
  const target = Math.round(canvas * markRatio);
  const mark = await sharp(Buffer.from(svg))
    .resize({ width: target, height: target, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(out);

  console.log(`  ${path.basename(out)}  ${canvas}x${canvas}`);
}

const opaqueBrand = { r: 0, g: 77, b: 231, alpha: 1 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

console.log("icons:");

// Store icon: white mark on solid brand, edge to edge (iOS/Android mask it).
await renderCentred({
  svg: markSvg("#FFFFFF"),
  canvas: 1024,
  markRatio: 0.56,
  background: opaqueBrand,
  out: path.join(images, "icon.png"),
});

// Adaptive foreground must stay inside the centre ~66% or the launcher crops it.
await renderCentred({
  svg: markSvg("#FFFFFF"),
  canvas: 512,
  markRatio: 0.42,
  background: transparent,
  out: path.join(images, "android-icon-foreground.png"),
});

await sharp({ create: { width: 512, height: 512, channels: 4, background: opaqueBrand } })
  .png()
  .toFile(path.join(images, "android-icon-background.png"));
console.log("  android-icon-background.png  512x512");

// Themed icons are tinted from the alpha channel, so this is a flat silhouette.
await renderCentred({
  svg: markSvg("#FFFFFF"),
  canvas: 512,
  markRatio: 0.42,
  background: transparent,
  out: path.join(images, "android-icon-monochrome.png"),
});

await renderCentred({
  svg: markSvg(BRAND),
  canvas: 48,
  markRatio: 0.8,
  background: transparent,
  out: path.join(images, "favicon.png"),
});

// Splash shows the full lockup in white; app.json paints the brand background.
const lockup = await sharp(Buffer.from(lockupSvg("#FFFFFF")))
  .resize({ width: 900, fit: "contain", background: transparent })
  .png()
  .toBuffer();
writeFileSync(path.join(images, "splash-icon.png"), lockup);
const meta = await sharp(lockup).metadata();
console.log(`splash:\n  splash-icon.png  ${meta.width}x${meta.height}`);
