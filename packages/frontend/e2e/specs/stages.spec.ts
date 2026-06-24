import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Project stages, the high-level programme breakdown.
 * - Upstream trigger: the build is split into stages to structure the schedule
 *   and progress reporting.
 * - Expected guardrail: an added stage PERSISTS with its name so progress can be
 *   tracked against it.
 * - Failure liability: a lost stage is a gap in the programme structure —
 *   progress and reporting drift from the real plan.
 */
test.describe("Project stages @regression @stages", () => {
  test("adds a stage that persists with its name @smoke", async ({ page, project }) => {
    const stages = new ListUpsertPage(page, project.id, {
      route: "schedules/stages",
      createButton: /add stage/i,
      createTitle: /add stage/i,
      createSubmit: /add stage/i,
    });
    await stages.goto();

    const name = uniqueName("Superstructure");
    await stages.create([[/stage name/i, name]]);

    await expect(stages.row(name)).toBeVisible();
  });
});
