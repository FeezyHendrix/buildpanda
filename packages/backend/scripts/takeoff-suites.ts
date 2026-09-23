// The canonical take-off gate, and the one list of what it covers.
//
// `tsx --test a.ts b.ts` SKIPS a named file that is not on disk and still exits
// 0. That is how 15 of the 43 suites this gate named came to be `.gitignore`d
// without anyone noticing: they ran here, they were absent from a fresh clone,
// and the clone's gate went green over the missing half. So the manifest is
// read by code that checks it, not spliced into a shell string:
//
//   * a suite named here but absent on disk        -> exit 1, named
//   * a *.test.ts in a covered directory but absent
//     from the manifest                            -> exit 1, named
//
// The second check is what keeps `.gitignore` honest: a suite can only travel
// with the branch if it is un-ignored there, and it can only be un-ignored
// usefully if it is gated here, so the two lists are closed against each other
// from both ends. Nothing below shells out to git — a deployed tarball has no
// `.git`, and the checks must still mean something inside one.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `packages/backend` — every path below is relative to it, as is the gate's cwd. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const TAKEOFF = "src/modules/panda-ai/pdf-takeoff";

/** Real-database and pure suites for the editor, run under the backend tsconfig. */
const BACKEND_SUITES: readonly string[] = [
  `${TAKEOFF}/editor-measurement-maths.test.ts`,
  `${TAKEOFF}/editor-locked-writes.test.ts`,
  `${TAKEOFF}/editor-restructure-rerun.test.ts`,
  `${TAKEOFF}/editor-rerun-atomicity.test.ts`,
  `${TAKEOFF}/editor-parameter-edits.test.ts`,
  `${TAKEOFF}/editor-deduction-edits.test.ts`,
  `${TAKEOFF}/editor-geometry.test.ts`,
  `${TAKEOFF}/editor-operations.test.ts`,
  `${TAKEOFF}/editor-persistence.test.ts`,
  `${TAKEOFF}/editor-operation-api.test.ts`,
  `${TAKEOFF}/editor-undo-redo.test.ts`,
  `${TAKEOFF}/editor-foundation.test.ts`,
  `${TAKEOFF}/editor-tombstones.test.ts`,
  `${TAKEOFF}/editor-concurrency.test.ts`,
  `${TAKEOFF}/editor-commands.test.ts`,
  `${TAKEOFF}/editor-commands-batch.test.ts`,
  `${TAKEOFF}/editor-batch-topology.test.ts`,
  `${TAKEOFF}/editor-batch-restructure.test.ts`,
  `${TAKEOFF}/editor-batch-edges.test.ts`,
  `${TAKEOFF}/editor-identity-edges.test.ts`,
  `${TAKEOFF}/editor-calibration.test.ts`,
  `${TAKEOFF}/editor-calibration-refusals.test.ts`,
  `${TAKEOFF}/editor-deduction-dimensionality.test.ts`,
  `${TAKEOFF}/editor-input-refusals.test.ts`,
  `${TAKEOFF}/editor-audit-restore.test.ts`,
  `${TAKEOFF}/editor-viewports.test.ts`,
  `${TAKEOFF}/editor-deduction-rescale.test.ts`,
  `${TAKEOFF}/editor-deduction-blocks.test.ts`,
  `${TAKEOFF}/editor-sheet-settings.test.ts`,
  `${TAKEOFF}/editor-markup-receipts.test.ts`,
  `${TAKEOFF}/editor-logical-shapes.test.ts`,
  `${TAKEOFF}/editor-multisheet-batch.test.ts`,
  `${TAKEOFF}/editor-merge-multishape.test.ts`,
  `${TAKEOFF}/editor-merge-union.test.ts`,
  `${TAKEOFF}/editor-stated-deductions.test.ts`,
  `${TAKEOFF}/editor-repeats.test.ts`,
  `${TAKEOFF}/editor-row-dto.test.ts`,
  `${TAKEOFF}/editor-integration.test.ts`,
  // A line with no shape at all is still a line of THIS take-off: the envelope
  // used to infer membership from drawings, so a line that had none was reachable
  // from another organisation's session.
  `${TAKEOFF}/editor-cross-session-rows.test.ts`,
  // The sentence a bill line is defended with, pinned to the figure beside it.
  `${TAKEOFF}/measurement-basis.test.ts`,
  // A coordinate must be typed by the caller, never invented by the validator —
  // and the scope that enforces that must not reach the rest of the API.
  `${TAKEOFF}/validation-scope.test.ts`,
  `${TAKEOFF}/apply-to-estimate.test.ts`,
  `${TAKEOFF}/apply-to-estimate-locks.test.ts`,
  // The workbook calculation engine. `workbook-engine.test.ts` spawns real
  // Univer workers, so it is the slowest suite here and the only one that
  // proves a cycle is refused before a figure is published; `workbook-build`
  // is the tripwire for the worker entry surviving the bundle.
  `${TAKEOFF}/workbook/workbook-bounds.test.ts`,
  `${TAKEOFF}/workbook/workbook-graph.test.ts`,
  `${TAKEOFF}/workbook/workbook-engine.test.ts`,
  `${TAKEOFF}/workbook/workbook-build.test.ts`,
  // Worker lifecycle measured by the threads themselves: a released queue slot
  // is not proof a thread died, and an abandoned job must never be started.
  `${TAKEOFF}/workbook/workbook-lifecycle.test.ts`,
  // The persisted workbook's two integrity properties, both pure: a worksheet
  // slot never comes to mean a different bill line, and a measured figure
  // cannot be typed over by the document that renders it.
  `${TAKEOFF}/workbook/workbook-bindings.test.ts`,
  `${TAKEOFF}/workbook/workbook-protection.test.ts`,
  // Real Postgres: what a retry is answered with, what the rest of the building
  // is told, and what a refusal leaves behind. `workbook-cancel` opens a real
  // socket on an ephemeral port — `inject()` cannot tell a hang-up from a
  // completed response, which is precisely where the disconnect bug lived.
  `${TAKEOFF}/workbook/workbook-api.test.ts`,
  `${TAKEOFF}/workbook/workbook-cancel.test.ts`,
  // The bytes a QS actually downloads, parsed back with ExcelJS: a remeasured
  // figure rather than the one the workbook was saved with, a withdrawn line as
  // `#REF!` rather than 0, and a worksheet Excel forced us to rename with every
  // formula still pointing at it.
  `${TAKEOFF}/workbook/workbook-export.test.ts`,
  `${TAKEOFF}/workbook/workbook-export-names.test.ts`,
  // What the two assistants can actually say about a measured quantity: the
  // openings, the repeat and the scale, or the half-answer that preceded them.
  "src/modules/panda-ai/agent/precon-boq-basis.test.ts",
  // And what they may say about a saved workbook: formulas and sources, never a
  // figure from the last save, and never another project's take-off.
  "src/modules/panda-ai/agent/precon-workbook-read.test.ts",
  "src/modules/panda-ai/precon-assist/context-basis.test.ts",
  "src/modules/drawing-markup/precon-editor.test.ts",
  "src/modules/drawing-markup/precon-editor-db.test.ts",
];

const VIEWER = "../frontend/src/components/molecules/precon-sheet-viewer";
const WORKBOOK = "../frontend/src/components/molecules/precon-workbook";

/**
 * The viewer's pure models. They live in the frontend package, so they need its
 * tsconfig for `@/*` and its JSX settings; the path stays relative because the
 * gate always runs with cwd = `packages/backend`.
 */
const FRONTEND_SUITES: readonly string[] = [
  `${VIEWER}/editor-state.test.ts`,
  `${VIEWER}/detection-model.test.ts`,
  `${VIEWER}/draft-history.test.ts`,
  `${VIEWER}/overlay-model.test.ts`,
  `${VIEWER}/polygon-validity.test.ts`,
  `${VIEWER}/saved-edit-model.test.ts`,
  // The lost update the browser gate raised as B1: a working copy opened against
  // a stale cached version, saved over someone else's edit.
  `${VIEWER}/saved-edit-open.test.ts`,
  `${VIEWER}/shape-edit-model.test.ts`,
  `${VIEWER}/stacked-picker.test.ts`,
  // The workbook's pure models. `workbook-fixture.ts` beside them is the shape
  // a real `GET .../workbook` returned, so all three describe the document the
  // server actually serves rather than one invented to pass.
  `${WORKBOOK}/workbook-serialization.test.ts`,
  `${WORKBOOK}/workbook-protection.test.ts`,
  `${WORKBOOK}/workbook-editing.test.ts`,
];

/** Directories the manifest is closed over: every `*.test.ts` under one must be gated. */
const COVERED_DIRS: readonly string[] = [
  TAKEOFF,
  "src/modules/panda-ai/agent",
  "src/modules/panda-ai/precon-assist",
  "src/modules/drawing-markup",
  VIEWER,
  WORKBOOK,
];

const MANIFEST: readonly string[] = [...BACKEND_SUITES, ...FRONTEND_SUITES];

const abs = (relative: string): string => resolve(PACKAGE_ROOT, relative);

/** Named in the manifest, not on disk — the failure a `tsx --test` run swallows. */
function absentSuites(): string[] {
  return MANIFEST.filter((suite) => !existsSync(abs(suite)));
}

/** On disk under a covered directory, absent from the manifest — a regression nobody runs. */
function ungatedSuites(): string[] {
  const gated = new Set(MANIFEST.map((suite) => abs(suite)));
  const found: string[] = [];
  for (const dir of COVERED_DIRS) {
    const root = abs(dir);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!entry.endsWith(".test.ts")) continue;
      const full = join(root, entry);
      if (!gated.has(full)) found.push(`${dir}/${entry}`);
    }
  }
  return found.sort();
}

function preflight(): void {
  const absent = absentSuites();
  const ungated = ungatedSuites();
  for (const suite of absent) {
    console.error(`takeoff gate: MISSING SUITE — named in the manifest, not on disk: ${suite}`);
  }
  for (const suite of ungated) {
    console.error(`takeoff gate: UNGATED SUITE — on disk, not in the manifest: ${suite}`);
  }
  if (absent.length > 0 || ungated.length > 0) {
    console.error(
      `takeoff gate: refusing to run — ${absent.length} missing, ${ungated.length} ungated. ` +
        "A missing suite is usually a .gitignore entry this checkout never got; an ungated one " +
        "is a regression the gate would never have run. Fix .gitignore and this manifest together.",
    );
    process.exit(1);
  }
  console.log(`takeoff gate: ${MANIFEST.length} suites named, ${MANIFEST.length} present, 0 ungated.`);
}

/** The repo's own tsx, so the gate runs the pinned version rather than whatever is on PATH. */
function tsxBin(): string {
  const local = resolve(PACKAGE_ROOT, "node_modules/.bin/tsx");
  return existsSync(local) ? local : "tsx";
}

function runSuites(args: readonly string[]): number {
  const result = spawnSync(tsxBin(), args, { cwd: PACKAGE_ROOT, stdio: "inherit" });
  if (result.error) {
    console.error(`takeoff gate: could not start tsx — ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

preflight();
const backend = runSuites(["--test", ...BACKEND_SUITES]);
// Same `&&` ordering the gate has always had: the viewer models only run once
// the backend contract they describe is green.
process.exit(backend === 0 ? runSuites(["--tsconfig", "../frontend/tsconfig.json", "--test", ...FRONTEND_SUITES]) : backend);
