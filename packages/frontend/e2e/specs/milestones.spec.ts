import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Milestone payments, the cost-gated schedule drivers.
 * - Upstream trigger: a payment milestone (with an amount) is defined against a
 *   project phase to gate cashflow against progress.
 * - Expected guardrail: a milestone PERSISTS with its name; phase + amount carry
 *   their (valid) defaults so the record is well-formed.
 * - Failure liability: a lost milestone is an untracked payment gate — cashflow
 *   released against the wrong progress, or a missed billing trigger.
 */
test.describe("Milestone payments @regression @milestones", () => {
  test("creates a milestone that persists with its name @smoke", async ({ page, project }) => {
    const milestones = new ListUpsertPage(page, project.id, {
      route: "finances/milestone-payments",
      createButton: /new milestone/i,
      createTitle: /new milestone/i,
      createSubmit: /create milestone/i,
    });
    await milestones.goto();

    const name = uniqueName("Foundation complete");
    // phase defaults to the first project phase and amount defaults to 0, so the
    // form is valid once the name is filled.
    await milestones.create([[/^name$/i, name]]);

    await expect(milestones.row(name)).toBeVisible();
  });
});
