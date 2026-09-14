import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Site Queries, the informal day-to-day question log.
 * - Upstream trigger: a site operative needs a quick clarification to keep
 *   working.
 * - Expected guardrail: a raised query PERSISTS with its subject so it can be
 *   answered and closed.
 * - Failure liability: a dropped query is a small unanswered question that
 *   compounds — repeated rework, slow decisions, frustrated trades.
 */
test.describe("Site Queries @regression @queries", () => {
  test("raises a query that persists with its subject @smoke", async ({ page, project }) => {
    const q = new ListUpsertPage(page, project.id, {
      route: "queries",
      createButton: /raise query/i,
      createTitle: /raise a query/i,
      createSubmit: /raise query/i,
    });
    await q.goto();

    const subject = uniqueName("Confirm rebar spacing");
    await q.create([
      [/subject/i, subject],
      [/question/i, "Is the rebar spacing 150mm or 200mm here?"],
    ]);

    await expect(q.row(subject)).toBeVisible();
  });
});
