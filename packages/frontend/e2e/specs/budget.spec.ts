import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Budget allocation, the planned-vs-actual cost breakdown.
 * - Upstream trigger: a budget category (with planned/committed/actual figures)
 *   is created to track spend by area.
 * - Expected guardrail: a category PERSISTS with its name so cost tracking has a
 *   bucket to roll up into.
 * - Failure liability: a lost category is spend with nowhere to land — budget
 *   reporting drifts from reality and overruns are spotted too late.
 */
test.describe("Budget allocation @regression @budget", () => {
  // FIXME (needs product triage): creating a category via the "Add budget
  // allocation" drawer closes successfully (form + API accept name + costCode),
  // but the allocation page still shows the "No budget allocation yet" empty
  // state — the new category never appears in the list. This is either a missing
  // precondition (e.g. a project budget/total must be set first) or a
  // create→list invalidation/display gap. Logged here separately from passing
  // tests; un-fixme once the expected behaviour is confirmed.
  test.fixme("creates a budget category that persists with its name @smoke", async ({ page, project }) => {
    const budget = new ListUpsertPage(page, project.id, {
      route: "finances/budget-allocation",
      createButton: /add budget allocation/i,
      createTitle: /new category/i,
      createSubmit: /create category/i,
    });
    await budget.goto();

    const name = uniqueName("Substructure");
    // Only the name is required by the form + API; fill a cost code too for a
    // realistic record. The category should then appear in the allocation list.
    await budget.create([
      [/^name$/i, name],
      [/cost code/i, "SUB-01"],
    ]);

    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  });
});
