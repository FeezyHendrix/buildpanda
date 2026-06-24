import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Equipment / rental requests, the plant-on-site pipeline.
 * - Upstream trigger: plant (a crane, hoist, pump) is requested for a window of
 *   the build.
 * - Expected guardrail: a request PERSISTS with its title so plant logistics can
 *   be tracked against the dates it is needed.
 * - Failure liability: a lost request is plant that never arrives (or arrives
 *   late) — a blocked lift, idle crew, and schedule slip.
 */
test.describe("Equipment requests @regression @equipment-requests", () => {
  test("creates an equipment request that persists with its title @smoke", async ({ page, project }) => {
    const equipment = new ListUpsertPage(page, project.id, {
      route: "equipment-requests",
      createButton: /create request/i,
      createTitle: /new equipment request/i,
      createSubmit: /create request/i,
    });
    await equipment.goto();

    const title = uniqueName("Crane for roof truss lift");
    // title + equipment + type + quantity + needed-from/until dates are required.
    await equipment.create([
      [/^title$/i, title],
      [/^equipment$/i, "Mobile crane"],
      [/^type$/i, "Crane"],
      [/^quantity$/i, "1"],
      [/needed from/i, "2026-12-20"],
      [/needed until/i, "2026-12-22"],
    ]);

    await expect(equipment.row(title)).toBeVisible();
  });
});
