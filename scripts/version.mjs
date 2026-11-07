import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGE_FILES = [
  "package.json",
  "packages/backend/package.json",
  "packages/frontend/package.json",
  "packages/web/package.json",
  "packages/admin/package.json",
];

const BUMPS = ["major", "minor", "patch"];

function parse(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Not a valid semver version: ${version}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function bump(version, kind) {
  const v = parse(version);
  if (kind === "major") return `${v.major + 1}.0.0`;
  if (kind === "minor") return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

function main() {
  const kind = process.argv[2];
  if (!BUMPS.includes(kind)) {
    console.error(`Usage: node scripts/version.mjs <${BUMPS.join("|")}>`);
    process.exit(1);
  }

  const current = readJson("package.json").version;
  const next = bump(current, kind);

  for (const rel of PACKAGE_FILES) {
    const abs = path.join(root, rel);
    const raw = readFileSync(abs, "utf8");
    const updated = raw.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${next}$2`);
    writeFileSync(abs, updated);
  }

  console.log(`Bumped ${current} -> ${next} across ${PACKAGE_FILES.length} packages.`);

  let status = "";
  try {
    status = execSync("git status --porcelain CHANGELOG.md", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    status = "";
  }
  if (!status) {
    console.warn("Warning: CHANGELOG.md has no staged/unstaged changes. Update it before tagging.");
  }

  console.log("");
  console.log("Next steps:");
  console.log(`  1. Move the Unreleased section in CHANGELOG.md under ## [${next}] - ${new Date().toISOString().slice(0, 10)}`);
  console.log(`  2. git commit -am "chore(release): v${next}"`);
  console.log(`  3. git tag -a v${next} -m "v${next}"`);
  console.log(`  4. git push && git push --tags`);
}

main();
