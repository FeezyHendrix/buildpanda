import { test, expect } from "../fixtures/test";

test.describe("Settings member invitations @settings @invitations", () => {
  test("owner can open the member invite dialog from Settings", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "owner", "owner-only settings action");

    await page.goto("/dashboard/settings?tab=members");

    await page.getByRole("button", { name: /invite member/i }).click();

    await expect(page.getByRole("heading", { name: /invite a team member/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^role$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send invitation/i })).toBeDisabled();
  });
});
