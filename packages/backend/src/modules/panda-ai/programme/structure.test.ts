import { test } from "node:test";
import assert from "node:assert/strict";
import { structureProgramme } from "./structure.ts";
import type { ParsedProgramme, ProgrammeTask } from "./parser.ts";

function task(overrides: Partial<ProgrammeTask> & Pick<ProgrammeTask, "refId" | "wbs" | "outlineLevel" | "name">): ProgrammeTask {
  return {
    isSummary: false,
    isMilestone: false,
    start: "2026-01-01T00:00:00.000Z",
    finish: "2026-01-02T00:00:00.000Z",
    durationDays: 1,
    percentComplete: 0,
    predecessors: [],
    cost: 0,
    ...overrides,
  };
}

test("hierarchical programme import preserves summary rows and parent links", async () => {
  const parsed: ParsedProgramme = {
    projectName: "Sample Programme",
    start: "2026-01-01T00:00:00.000Z",
    finish: "2026-01-10T00:00:00.000Z",
    sourceTaskCount: 5,
    skippedTaskCount: 1,
    tasks: [
      task({ refId: "1", wbs: "1", outlineLevel: 1, name: "Project summary", isSummary: true }),
      task({ refId: "2", wbs: "1.1", outlineLevel: 2, name: "Substructure", isSummary: true }),
      task({ refId: "3", wbs: "1.1.1", outlineLevel: 3, name: "Excavation" }),
      task({ refId: "4", wbs: "1.1.2", outlineLevel: 3, name: "Blinding" }),
    ],
  };

  const structured = await structureProgramme(parsed, "Fallback");

  assert.equal(structured.sourceTaskCount, 5);
  assert.equal(structured.skippedTaskCount, 1);
  assert.equal(structured.activities.length, 4);
  assert.equal(structured.summaryActivityCount, 2);
  assert.deepEqual(
    structured.activities.map((activity) => ({ refId: activity.refId, parentRefId: activity.parentRefId, isSummary: activity.isSummary })),
    [
      { refId: "1", parentRefId: null, isSummary: true },
      { refId: "2", parentRefId: "1", isSummary: true },
      { refId: "3", parentRefId: "2", isSummary: false },
      { refId: "4", parentRefId: "2", isSummary: false },
    ],
  );
});
