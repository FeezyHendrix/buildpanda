// Publishes the output of `expo export` to the BuildPanda OTA endpoint.
//
//   EXPO_PUBLIC_API_URL=... OTA_PUBLISH_TOKEN=... node scripts/publish-ota.mjs android
//
// Only JS and assets travel this way. Anything native — a new dependency, an
// icon, app.json config — needs a fresh APK, and must also bump `version` in
// app.json so older installs stop accepting the new bundle.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(root, "dist");

const platform = process.argv[2] ?? "android";
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const token = process.env.OTA_PUBLISH_TOKEN ?? "";

if (!apiUrl) throw new Error("EXPO_PUBLIC_API_URL is required");
if (!token) throw new Error("OTA_PUBLISH_TOKEN is required");

const metadata = JSON.parse(await readFile(path.join(dist, "metadata.json"), "utf8"));
const platformFiles = metadata.fileMetadata?.[platform];
if (!platformFiles) {
  throw new Error(`No exported files for platform "${platform}" — did expo export run?`);
}

// runtimeVersion must match what the build baked in. app.config.ts uses the
// appVersion policy, so it is app.json's `version`.
const appJson = JSON.parse(await readFile(path.join(root, "app.json"), "utf8"));
const runtimeVersion = appJson.expo.version;

const assets = platformFiles.assets ?? [];
const manifest = {
  platform,
  runtimeVersion,
  commitSha: process.env.GITHUB_SHA ?? null,
  launchAsset: { path: platformFiles.bundle, ext: "bundle" },
  assets,
};

const form = new FormData();
// The field must precede the files: the server reads parts in order and needs
// the manifest before it can match uploads to their descriptors.
form.append("manifest", JSON.stringify(manifest));

async function appendFile(relativePath) {
  const body = await readFile(path.join(dist, relativePath));
  form.append(relativePath, new Blob([body]), path.basename(relativePath));
}

await appendFile(platformFiles.bundle);
for (const asset of assets) {
  await appendFile(asset.path);
}

console.log(
  `Publishing ${platform} runtime ${runtimeVersion}: 1 bundle + ${assets.length} assets -> ${apiUrl}/ota/publish`,
);

const response = await fetch(`${apiUrl}/ota/publish`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: form,
});

const text = await response.text();
if (!response.ok) {
  throw new Error(`Publish failed (${response.status}): ${text}`);
}
console.log("Published:", text);
