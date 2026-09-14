import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Inspections, the quality-gate request log.
 * - Upstream trigger: work reaches a stage that must be inspected/signed off
 *   before the next trade can proceed.
 * - Expected guardrail: a requested inspection PERSISTS with its title so the
 *   quality gate is tracked and can be scheduled.
 * - Failure liability: a lost inspection request is an un-inspected gate — work
 *   covered up without sign-off, rework on discovery, compliance failure.
 */
test.describe("Inspections @regression @inspections", () => {
  test("requests an inspection that persists with its title @smoke", async ({ page, project }) => {
    const inspections = new ListUpsertPage(page, project.id, {
      route: "inspections",
      createButton: /request new inspection/i,
      createTitle: /request a new inspection/i,
      createSubmit: /request inspection/i,
    });
    await inspections.goto();

    const title = uniqueName("Foundation rebar inspection");
    // title + description + a preferred date are required to enable submit.
    await inspections.create([
      [/^title$/i, title],
      [/what needs inspecting/i, "Check rebar spacing and cover before the pour."],
      [/preferred date/i, "2026-12-31"],
    ]);

    await expect(inspections.row(title)).toBeVisible();
  });
});
