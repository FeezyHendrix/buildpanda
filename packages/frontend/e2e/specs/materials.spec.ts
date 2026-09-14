import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Material orders, the procurement pipeline.
 * - Upstream trigger: materials are ordered (with quantity, unit and a needed-by
 *   date) to feed the build.
 * - Expected guardrail: an order PERSISTS with its title so procurement and
 *   on-site delivery can be tracked against the schedule.
 * - Failure liability: a lost order is a material that never arrives — a stalled
 *   trade, idle crew, and schedule slip while the gap is discovered.
 */
test.describe("Material orders @regression @materials", () => {
  test("creates a material order that persists with its title @smoke", async ({ page, project }) => {
    const materials = new ListUpsertPage(page, project.id, {
      route: "materials",
      createButton: /new material order/i,
      createTitle: /new material order/i,
      createSubmit: /create order/i,
    });
    await materials.goto();

    const title = uniqueName("Cement for first-floor blockwork");
    // title + material + quantity + unit are required; needed-by defaults to
    // today, so those four fields are enough to enable submit.
    await materials.create([
      [/^title$/i, title],
      [/^material$/i, "Dangote cement 42.5"],
      [/^quantity$/i, "100"],
      [/^unit$/i, "bags"],
    ]);

    await expect(materials.row(title)).toBeVisible();
  });
});
