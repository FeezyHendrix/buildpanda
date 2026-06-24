import { test, expect } from "../fixtures/test";
import { ListUpsertPage } from "../pages/list-upsert.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — RFIs (Requests for Information), the formal question channel.
 * - Upstream trigger: a site team raises a question that blocks work until the
 *   designer/consultant answers.
 * - Expected guardrail: a raised RFI PERSISTS with its subject after save; it is
 *   tracked so the answer can be chased (an RFI is a contractual record).
 * - Failure liability: a dropped RFI is an unanswered blocking question with no
 *   paper trail — work stalls or proceeds on a guess, causing rework/disputes.
 */
test.describe("RFIs @regression @rfis", () => {
  test("raises an RFI that persists with its subject @smoke", async ({ page, project }) => {
    const rfis = new ListUpsertPage(page, project.id, {
      route: "rfis",
      createButton: /raise rfi/i,
      createTitle: null,
      createSubmit: /create rfi/i,
    });
    await rfis.goto();

    const subject = uniqueName("Casement vs sliding windows");
    await rfis.create([
      [/subject/i, subject],
      [/question/i, "Which window type for the west elevation?"],
    ]);

    // Guardrail: the RFI is listed after the mutation settles.
    await expect(rfis.row(subject)).toBeVisible();
  });
});
