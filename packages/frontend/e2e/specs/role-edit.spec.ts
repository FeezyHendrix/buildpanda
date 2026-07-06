import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/test";
import { uniqueName } from "../fixtures/ids";

function permissionRow(page: Page, resource: string): Locator {
  return page
    .locator("div", { has: page.getByText(resource, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: /^view$/i }) })
    .last();
}

function drawerSubmit(page: Page, name: RegExp): Locator {
  return page.locator("footer").getByRole("button", { name });
}

/**
 * RISK MAP — Editing a custom role's access after creation.
 * - Upstream trigger: an admin creates a custom role (e.g. Site Clerk), then
 *   later needs to change which actions that role can perform.
 * - Expected guardrail: each custom role row exposes an Edit action that opens
 *   the builder pre-filled with the role's current access; saving persists the
 *   new permission set (name stays fixed as the role's identity).
 * - Failure liability: without an edit path, a mis-scoped role can only be
 *   deleted and rebuilt, and every member on it must be reassigned.
 */
test.describe("Custom role editing @regression @roles", () => {
  test("admin edits a custom role's access after creation @smoke", async ({ page }) => {
    const roleLabel = uniqueName("Site Clerk");
    const roleName = roleLabel.toLowerCase().replace(/\s+/g, "-");
    // The list renders the slug title-cased ("site-clerk-abc-de" -> "Site Clerk
    // Abc De"), so match the row by the run's unique hex token, not the raw name.
    const rowToken = roleName.split("-").slice(2).join(" ");

    await page.goto("/dashboard/settings/team");

    // Create the role with a single Documents permission.
    await page.getByRole("button", { name: /create role/i }).click();
    await page.locator("#role-name").fill(roleLabel);
    await permissionRow(page, "Documents").getByRole("button", { name: /^view$/i }).click();
    await drawerSubmit(page, /^create role$/i).click();

    const row = page
      .locator("div")
      .filter({ hasText: rowToken })
      .filter({ has: page.getByRole("button", { name: /^edit$/i }) })
      .last();
    await expect(row).toBeVisible();
    await expect(row.getByText(/1 resource configured/i)).toBeVisible();

    // Edit: the builder must pre-fill and lock the name, and let us add access.
    await row.getByRole("button", { name: /^edit$/i }).click();
    await expect(page.getByText(/edit role access/i)).toBeVisible();
    await expect(page.locator("#role-name")).toBeDisabled();
    await expect(page.locator("#role-name")).toHaveValue(roleName);

    await permissionRow(page, "Materials").getByRole("button", { name: /^view$/i }).click();
    await drawerSubmit(page, /^save changes$/i).click();

    // The row now reflects two configured resources — the edit persisted.
    const updated = page
      .locator("div")
      .filter({ hasText: rowToken })
      .filter({ has: page.getByRole("button", { name: /^edit$/i }) })
      .last();
    await expect(updated.getByText(/2 resources configured/i)).toBeVisible();
  });
});
