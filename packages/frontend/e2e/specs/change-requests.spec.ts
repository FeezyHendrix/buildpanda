import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Change Requests, the only surface that may move cost & time.
 * - Upstream trigger: scope changes (a client wants casement instead of sliding
 *   windows) that have a budget and/or schedule impact.
 * - Expected guardrail: a change request PERSISTS with its title; it owns
 *   cost_impact / time_impact_days (RFIs deliberately do NOT affect budget — only
 *   change requests do, a distinction enforced in the data model).
 * - Failure liability: a lost change request is unbilled scope or an untracked
 *   delay — margin erosion and disputes over what was agreed.
 */
test.describe("Change Requests @regression @change-requests", () => {
  test("creates a change request that persists with its title @smoke", async ({ page, project }) => {
    const cr = new ListUpsertPage(page, project.id, {
      route: "change-requests",
      createButton: /new change request/i,
      createTitle: /new change request/i,
      createSubmit: /^create$/i,
    });
    await cr.goto();

    const title = uniqueName("Switch to casement windows");
    await cr.create([[/title/i, title]]);

    await expect(cr.row(title)).toBeVisible();
  });
});
