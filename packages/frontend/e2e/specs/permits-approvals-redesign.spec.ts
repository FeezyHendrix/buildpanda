import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";
import { uniqueName } from "../fixtures/ids";

function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * RISK MAP — Permits & Compliance urgency surfacing.
 * - Upstream trigger: permits expire; work is illegal once a permit lapses.
 * - Expected guardrail: the page groups by urgency (Needs attention / Active),
 *   shows a relative-time expiry ("Expired N days ago" / "Expires in N days"),
 *   and the backend infers status from the dates (an approved-date permit reads
 *   "Approved" without the user picking a status).
 * - Failure liability: if expiry isn't surfaced, a lapsed permit looks identical
 *   to a valid one and the build proceeds on expired compliance.
 */
test.describe("Permits & Compliance redesign @permits", () => {
  test("groups permits by urgency with relative expiry and inferred status", async ({
    page,
    project,
    api,
  }) => {
    const expiredTitle = uniqueName("Expired building permit");
    const soonTitle = uniqueName("Expiring town-planning");
    const activeTitle = uniqueName("Valid C of O");

    // Past expiry -> Expired + "Needs attention". Approved date drives status.
    await api.postOrThrow(`/projects/${project.id}/permits`, {
      title: expiredTitle,
      authority: "Lagos State",
      approvedDate: isoOffset(-400),
      expiryDate: isoOffset(-5),
    });
    // Expiry within 30 days -> expiringSoon + "Needs attention".
    await api.postOrThrow(`/projects/${project.id}/permits`, {
      title: soonTitle,
      authority: "LASPPPA",
      approvedDate: isoOffset(-10),
      expiryDate: isoOffset(12),
    });
    // Far-future expiry -> active.
    await api.postOrThrow(`/projects/${project.id}/permits`, {
      title: activeTitle,
      authority: "Land Registry",
      approvedDate: isoOffset(-2),
      expiryDate: isoOffset(400),
    });

    const nav = new ProjectNav(page, project.id);
    await nav.goto("permits");
    const main = page.getByRole("main");

    // Grouping headers (with inline counts) + attention chips are present.
    await expect(main.getByRole("heading", { name: /Needs attention/i })).toBeVisible();
    await expect(main.getByRole("heading", { name: /^Active/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /expired/i })).toBeVisible();

    // Relative-time expiry labels (the core improvement), not raw dates only.
    await expect(main.getByText(/Expired 5 day\(s\) ago/i)).toBeVisible();
    await expect(main.getByText(/Expires in 12 day\(s\)/i)).toBeVisible();

    // Status was inferred from the approved date — no manual status was sent,
    // yet the active permit reads "Approved".
    await expect(main.getByText(activeTitle, { exact: true })).toBeVisible();
    await expect(main.getByText(/Valid until/i)).toBeVisible();
  });
});

/**
 * RISK MAP — Client Approvals inline decision.
 * - Upstream trigger: a spec/selection is submitted for the client's sign-off.
 * - Expected guardrail: an approver can Approve directly from the list (inline
 *   CTA), and the item moves out of "Awaiting decision" into "Decided".
 * - Failure liability: a buried decision flow stalls sign-offs and the build.
 */
test.describe("Client Approvals redesign @approvals", () => {
  test("approves an item inline and it moves to Decided", async ({ page, project, api }) => {
    const title = uniqueName("Master bath tile");
    await api.postOrThrow(`/projects/${project.id}/approvals`, {
      title,
      category: "Finishes",
      description: "Matte vs gloss",
    });

    const nav = new ProjectNav(page, project.id);
    await nav.goto("approvals");
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: /Awaiting decision/i })).toBeVisible();
    const card = main.locator("div").filter({ hasText: title }).first();
    await expect(card).toBeVisible();

    // Inline Approve CTA on the card decides without opening the detail dialog.
    await card.getByRole("button", { name: /^approve$/i }).click();

    // Success toast + the item is now Approved and under "Decided".
    await expect(page.getByText(/approval approved/i)).toBeVisible();
    await expect(main.getByRole("heading", { name: /Decided/i })).toBeVisible();
  });
});
