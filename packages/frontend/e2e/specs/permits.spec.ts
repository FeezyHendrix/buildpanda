import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Permits & approvals, the regulatory-compliance register.
 * - Upstream trigger: a permit/approval is required (and expires) before work
 *   may legally proceed.
 * - Expected guardrail: a permit PERSISTS with its title so its status and
 *   expiry are tracked.
 * - Failure liability: a lost permit record is unmonitored compliance — building
 *   without/after a lapsed permit risks stop-work orders, fines, legal exposure.
 */
test.describe("Permits @regression @permits", () => {
  test("adds a permit that persists with its title @smoke", async ({ page, project }) => {
    const permits = new ListUpsertPage(page, project.id, {
      route: "permits",
      createButton: /add permit/i,
      createTitle: /add permit \/ approval/i,
      createSubmit: /^add$/i,
    });
    await permits.goto();

    const title = uniqueName("Building permit");
    await permits.create([[/title/i, title]]);

    await expect(permits.row(title)).toBeVisible();
  });
});
