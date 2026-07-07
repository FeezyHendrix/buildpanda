import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — RFI ball-in-court owner can be a contact (non-user).
 * - Upstream trigger: a PM raises an RFI and hands it to a project contact
 *   (team member) who has no BuildPanda account, only an email.
 * - Expected guardrail: the contact is selectable as ball-in-court, the notify
 *   email pre-fills from the contact and stays editable, and the saved RFI
 *   PERSISTS showing the contact's name — proving the contact path (no user id)
 *   round-trips through create and the denormalized name/email storage.
 * - Failure liability: if contacts can't own an RFI, or the name/email is lost,
 *   the question goes to nobody and the paper trail is broken.
 */
test.describe("RFI ball-in-court contact @rfis", () => {
  test("assigns a contact as ball-in-court with a pre-filled, editable email", async ({
    page,
    project,
    api,
  }) => {
    const contactName = uniqueName("Design Consultant");
    const contactCompany = "Arup";
    const contactEmail = `consultant-${Date.now()}@example.com`;
    await api.postOrThrow(`/projects/${project.id}/team-members`, {
      name: contactName,
      role: "Consultant",
      company: contactCompany,
      email: contactEmail,
      status: "Active",
    });

    const nav = new ProjectNav(page, project.id);
    await nav.goto("rfis");

    await page.getByRole("button", { name: /raise rfi/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const subject = uniqueName("Confirm curtain wall glazing spec");
    await dialog.getByLabel(/subject/i).fill(subject);
    await dialog.getByLabel(/question/i).fill("Which glazing unit meets the U-value target?");

    const ballInCourt = dialog.getByLabel(/ball in court/i);
    const contactLabel = `${contactName} (${contactCompany})`;
    await expect(ballInCourt.getByRole("option", { name: contactLabel })).toBeAttached();
    await ballInCourt.selectOption({ label: contactLabel });

    // The notify email pre-fills from the selected contact.
    const emailField = dialog.getByLabel(/notify email/i);
    await expect(emailField).toHaveValue(contactEmail);

    // …and stays editable — override with a different address.
    const overrideEmail = `override-${Date.now()}@example.com`;
    await emailField.fill(overrideEmail);
    await expect(emailField).toHaveValue(overrideEmail);

    await dialog.getByRole("button", { name: /create rfi/i }).click();
    await expect(dialog).toBeHidden();

    // Guardrail: the RFI persists and shows the contact as ball-in-court owner.
    await expect(page.getByText(subject, { exact: true })).toBeVisible();
    await expect(page.getByText(contactLabel, { exact: true }).first()).toBeVisible();
  });
});
