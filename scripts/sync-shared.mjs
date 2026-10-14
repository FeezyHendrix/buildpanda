// Copies the canonical files in packages/shared into each app that uses them.
// The apps build separately (mobile installs on its own with npm in CI), so a
// workspace package would break their builds; one source plus a drift check
// keeps a single version without that. `--check` fails if any copy differs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = {
  "payload-crypto.ts": ["packages/frontend/src/lib", "packages/mobile/src/lib"],
  "payload-fetch.ts": ["packages/frontend/src/lib", "packages/mobile/src/lib"],
  "utils.ts": ["packages/frontend/src/lib", "packages/mobile/src/lib"],
  "material-match.ts": ["packages/backend/src/modules/materials-ledger", "packages/mobile/src/lib"],
};

const check = process.argv.includes("--check");
const stale = [];

for (const [file, dirs] of Object.entries(TARGETS)) {
  const source = readFileSync(path.join(root, "packages/shared", file), "utf8");
  const expected = `// Generated from packages/shared/${file}. Edit that file, then run \`pnpm sync:shared\`.\n${source}`;
  for (const dir of dirs) {
    const target = path.join(root, dir, file);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === expected) continue;
    if (check) stale.push(path.relative(root, target));
    else writeFileSync(target, expected);
  }
}

if (check && stale.length) {
  console.error(`Out of step with packages/shared (run \`pnpm sync:shared\`):\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? "Shared files are in step." : "Shared files synced.");
