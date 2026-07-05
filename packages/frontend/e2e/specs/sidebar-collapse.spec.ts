import { expect, type Page } from "@playwright/test";
import { test as base } from "../fixtures/test";

/**
 * RISK MAP — Desktop sidebar collapse/expand.
 * - Upstream trigger: a user hides the project sidebar to get a full-width
 *   main pane, then wants it back.
 * - Expected guardrail: the "Hide sidebar" control collapses the sidebar to
 *   zero width and a clickable "Show sidebar" tab restores it; the preference
 *   survives a reload.
 * - Failure liability: a user who collapses the sidebar and cannot re-open it
 *   loses all project navigation — a dead end on every project page.
 */

// Overflow-clipped content still counts as "visible" to Playwright, so assert
// on the aside's real width instead of element visibility.
async function asideWidth(page: Page): Promise<number> {
  const box = await page
    .locator("aside", { has: page.getByRole("link", { name: "Projects" }) })
    .boundingBox();
  return box?.width ?? 0;
}

base.describe("Project sidebar collapse @sidebar", () => {
  base("collapses, re-opens, and persists", async ({ page, project }) => {
    // Fresh users get the onboarding tour overlay, which intercepts clicks.
    // The seen-flag key embeds the userId, so stub reads for any tour key.
    await page.addInitScript(() => {
      const orig = localStorage.getItem.bind(localStorage);
      localStorage.getItem = (key: string) =>
        key.startsWith("buildpanda:tour:") ? "1" : orig(key);
    });
    await page.goto(`/project/${project.id}/overview`);

    const hideButton = page.getByRole("button", { name: "Hide sidebar" });
    const showButton = page.getByRole("button", { name: "Show sidebar" });

    // Expanded by default.
    await expect(hideButton).toBeVisible();
    await expect.poll(() => asideWidth(page)).toBeGreaterThan(200);

    // Collapse: sidebar shrinks to zero, expand tab appears.
    await hideButton.click();
    await expect.poll(() => asideWidth(page)).toBe(0);
    await expect(showButton).toBeVisible();

    // Re-open: sidebar returns to full width.
    await showButton.click();
    await expect.poll(() => asideWidth(page)).toBeGreaterThan(200);
    await expect(hideButton).toBeVisible();

    // Preference persists across a reload.
    await hideButton.click();
    await expect.poll(() => asideWidth(page)).toBe(0);
    await page.reload();
    await expect(showButton).toBeVisible();
    await expect.poll(() => asideWidth(page)).toBe(0);
    await showButton.click();
    await expect.poll(() => asideWidth(page)).toBeGreaterThan(200);
  });
});
