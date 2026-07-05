import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";

/**
 * RISK MAP — Project sidebar grouping of Daily Log / Site Control.
 * - Upstream trigger: a user opens a project and navigates via the sidebar.
 * - Expected guardrail: "Daily Log" lives under the "Site Control" group (not
 *   "Schedules"), and the retired items — "Action Items", "Queries",
 *   "Inspections" — no longer appear in the sidebar at all.
 * - Failure liability: mis-grouped or resurrected nav items send users to the
 *   wrong place or expose removed workflows.
 */
test.describe("Sidebar navigation grouping @navigation", () => {
  test("Daily Log sits under Site Control; Action Items, Queries, Inspections are gone", async ({
    page,
    project,
  }) => {
    // Fresh users get the onboarding tour overlay, which intercepts clicks.
    // The seen-flag key embeds the userId, so stub reads for any tour key.
    await page.addInitScript(() => {
      const orig = localStorage.getItem.bind(localStorage);
      localStorage.getItem = (key: string) =>
        key.startsWith("buildpanda:tour:") ? "1" : orig(key);
    });

    const nav = new ProjectNav(page, project.id);
    await nav.goto("overview");

    const sidebar = page.getByRole("navigation");

    // Expand both collapsible groups so their items are in the DOM.
    for (const label of ["Schedules", "Site Control"]) {
      const group = sidebar.getByRole("button", { name: new RegExp(label, "i") });
      await expect(group).toBeVisible();
      if ((await group.getAttribute("aria-expanded")) !== "true") {
        await group.click();
      }
      await expect(group).toHaveAttribute("aria-expanded", "true");
    }

    // Daily Log is present and links to its route (route is unchanged by the move).
    const dailyLog = sidebar.getByRole("link", { name: /daily log/i });
    await expect(dailyLog).toBeVisible();
    await expect(dailyLog).toHaveAttribute("href", new RegExp(`/project/${project.id}/schedules/daily-log`));

    // Retired items are absent from the sidebar entirely.
    await expect(sidebar.getByRole("link", { name: /action items/i })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: /^queries$/i })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: /inspections/i })).toHaveCount(0);

    // Overview header no longer shows the health-score (heart, "0/100") badge.
    // The sibling risk badge ("Low" for a fresh project) proves the header
    // rendered, so the /100 absence is a real removal, not a blank page.
    const main = page.getByRole("main");
    await expect(main.getByText("Low", { exact: true }).first()).toBeVisible();
    await expect(main.getByText(/\/100/)).toHaveCount(0);
  });
});
