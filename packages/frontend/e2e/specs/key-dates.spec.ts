import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Key Dates, the milestone tracker.
 * - Upstream trigger: a milestone the team wants to watch (handover, inspection,
 *   payment trigger) is set.
 * - Expected guardrail: a key date PERSISTS with its label so target vs actual
 *   can be tracked.
 * - Failure liability: a lost milestone is an unwatched deadline — missed
 *   handovers, slipped payment triggers, schedule blind spots.
 */
test.describe("Key Dates @regression @key-dates", () => {
  test("adds a key date that persists with its label @smoke", async ({ page, project }) => {
    const kd = new ListUpsertPage(page, project.id, {
      route: "key-dates",
      createButton: /add key date/i,
      createTitle: /add key date/i,
      createSubmit: /^add$/i,
    });
    await kd.goto();

    const label = uniqueName("Practical completion");
    await kd.create([[/label/i, label]]);

    await expect(kd.row(label)).toBeVisible();
  });
});
