import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { workerEntryUrl } from "./worker-client.ts";

// The worker has to survive the build, and nothing else in the test suite can
// notice if it stops.
//
// `worker-client.ts` reaches the worker by URL rather than by import, so a
// bundler sees no edge to follow. Deleting the worker from `tsup.config.ts`
// breaks no type, no import and no unit test — it breaks a deployed process,
// inside a thread, the first time someone saves a workbook. These assertions
// are the tripwire; the standalone dist driver is the other half of the proof.

const WORKBOOK_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(WORKBOOK_DIR, "../../../../..");
const ENTRY_SOURCE = "src/modules/panda-ai/pdf-takeoff/workbook/worker-entry.ts";

function packageRoot(...parts: string[]): string {
  return resolve(PACKAGE_ROOT, ...parts);
}

test("the worker entry this module resolves actually exists", () => {
  const entry = workerEntryUrl();
  const path = fileURLToPath(entry);
  assert.ok(existsSync(path), `worker entry must exist on disk, looked at ${path}`);
  assert.equal(dirname(path), WORKBOOK_DIR, "under tsx the worker is this module's sibling");
  assert.equal(basename(path), "worker-entry.ts", "and it is the TypeScript source");
});

test("the resolved name differs from the built one only by extension", () => {
  // This is the entire dev/deploy switch, so it is asserted rather than assumed:
  // swapping `.ts` for `.js` must land on the name the build emits.
  const entry = basename(fileURLToPath(workerEntryUrl()));
  assert.equal(entry.replace(/\.ts$/, ".js"), "worker-entry.js");
});

test("the build names the worker as its own entry, with the matching key", () => {
  const config = readFileSync(packageRoot("tsup.config.ts"), "utf8");

  assert.match(
    config,
    /"worker-entry":\s*"src\/modules\/panda-ai\/pdf-takeoff\/workbook\/worker-entry\.ts"/,
    `tsup.config.ts must emit ${ENTRY_SOURCE} under the key "worker-entry". The key is the built filename, and ` +
      "worker-client.ts resolves the worker by swapping this module's own extension, so the stem must match.",
  );
  assert.ok(existsSync(packageRoot(ENTRY_SOURCE)), "and the source it names must exist");
});

test("the build still emits the two server entries at their existing paths", () => {
  // `npm start` runs `node dist/cluster.js`. Renaming these to make room for
  // the worker would break deployment silently.
  const config = readFileSync(packageRoot("tsup.config.ts"), "utf8");
  assert.match(config, /cluster:\s*"src\/cluster\.ts"/);
  assert.match(config, /server:\s*"src\/server\.ts"/);
  assert.match(config, /format:\s*\["esm"\]/, "a CJS build would have no import.meta.url to resolve from");
});

// Asserting on `tsup.config.ts` alone was not enough: the config was correct
// and the deployment still shipped without a worker, because the Dockerfile ran
// its own entry list and a positional argument REPLACES the config's `entry`
// map. `--config <file>` names the config rather than an entry, so its value is
// dropped here rather than mistaken for one.
function dockerTsupArgs(): string[] {
  const dockerfile = readFileSync(packageRoot("Dockerfile"), "utf8");
  const runs = dockerfile.split("\n").filter((line) => /^\s*RUN\b/.test(line) && /\btsup\b/.test(line));
  const [build, ...extra] = runs;
  assert.ok(build, "the image must build with tsup");
  assert.deepEqual(extra, [], "and must do so exactly once");

  const tokens = build.trim().split(/\s+/);
  const args = tokens.slice(tokens.indexOf("tsup") + 1);
  return args.filter((_, index) => args[index - 1] !== "--config");
}

test("the deployed image builds from the config, not its own entry list", () => {
  const args = dockerTsupArgs();

  const entries = args.filter((arg) => !arg.startsWith("-") && /\.(ts|tsx|js|mjs)$/.test(arg));
  assert.deepEqual(
    entries,
    [],
    `packages/backend/Dockerfile passes ${entries.join(", ")} to tsup. A positional entry REPLACES the ` +
      "`entry` map in tsup.config.ts, so the worker is never emitted and the deployed process fails at " +
      "dist/worker-entry.js. The image must invoke tsup with no entry of its own.",
  );
  assert.ok(
    !args.some((arg) => arg === "--entry" || arg.startsWith("--entry.")),
    "--entry overrides the config's entry map for the same reason",
  );
});

// The image's own artifact guard, lifted out of its `RUN node -e "..."` and run
// here against dist layouts this test builds. Executing it is the only way to
// know it still catches the regression; reading it back would prove nothing.
function dockerArtifactGuard(): string {
  const line = readFileSync(packageRoot("Dockerfile"), "utf8")
    .split("\n")
    .find((candidate) => /^\s*RUN\s+node\s+-e\b/.test(candidate) && candidate.includes("worker-entry.js"));
  assert.ok(line, "the build stage must verify the emitted entries before the image is published");
  return line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
}

function guardExitCode(emitted: readonly string[]): number {
  const root = mkdtempSync(join(tmpdir(), "workbook-build-guard-"));
  try {
    mkdirSync(join(root, "dist"));
    for (const name of emitted) writeFileSync(join(root, "dist", name), "");
    const result = spawnSync(process.execPath, ["-e", dockerArtifactGuard()], { cwd: root, encoding: "utf8" });
    return result.status ?? -1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the image refuses to ship a build that is missing the worker", () => {
  const ALL = ["cluster.js", "server.js", "worker-entry.js", "workbook-engine.js"];

  assert.equal(guardExitCode(ALL), 0, "a complete build passes the image's own guard");
  assert.notEqual(
    guardExitCode(ALL.filter((name) => name !== "worker-entry.js")),
    0,
    "a build without the worker must fail the image, not a user's first save",
  );
});

test("the build script uses the config rather than its own entry list", () => {
  const manifest: unknown = JSON.parse(readFileSync(packageRoot("package.json"), "utf8"));
  assert.ok(typeof manifest === "object" && manifest !== null);
  const scripts: unknown = (manifest as { scripts?: unknown }).scripts;
  assert.ok(typeof scripts === "object" && scripts !== null);
  const build: unknown = (scripts as { build?: unknown }).build;

  assert.equal(
    build,
    "tsup",
    "a CLI entry list would override tsup.config.ts and drop the worker from the build",
  );
});

test("the engine's declared Univer dependencies are pinned and present", () => {
  // The worker is the only place Univer loads, and it loads by bare specifier
  // from the built bundle, so the dependency has to be declared here rather
  // than inherited from the workspace root.
  const manifest: unknown = JSON.parse(readFileSync(packageRoot("package.json"), "utf8"));
  const deps: unknown = (manifest as { dependencies?: unknown }).dependencies;
  assert.ok(typeof deps === "object" && deps !== null);
  const record = deps as Record<string, unknown>;

  assert.equal(record["@univerjs/presets"], "1.0.0");
  assert.equal(record["@univerjs/preset-sheets-node-core"], "1.0.0");
});
