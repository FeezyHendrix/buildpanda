import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";

/**
 * RISK MAP — Project sidebar grouping of schedule and field tools.
 * - Upstream trigger: a user opens a project and navigates via the sidebar.
 * - Expected guardrail: Field Tools carries site-control work, Look Aheads
 *   lives in Schedules, and BIM/Permits live next to Documents.
 * - Failure liability: mis-grouped or resurrected nav items send users to the
 *   wrong place or expose removed workflows.
 */
test.describe("Sidebar navigation grouping @navigation", () => {
  test("Field Tools groups site-control work", async ({
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

    const schedules = sidebar.getByRole("button", { name: /schedules/i });
    await expect(schedules).toBeVisible();
    if ((await schedules.getAttribute("aria-expanded")) !== "true") {
      await schedules.click();
    }
    await expect(schedules).toHaveAttribute("aria-expanded", "true");

    const fieldTools = sidebar.getByRole("button", { name: /field tools/i });
    await expect(fieldTools).toBeVisible();
    if ((await fieldTools.getAttribute("aria-expanded")) !== "true") {
      await fieldTools.click();
    }
    await expect(fieldTools).toHaveAttribute("aria-expanded", "true");

    await expect(sidebar.getByRole("button", { name: /site control/i })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: /look aheads/i })).toHaveAttribute("href", new RegExp(`/project/${project.id}/look-aheads`));
    await expect(sidebar.getByRole("link", { name: /rfis/i })).toHaveAttribute("href", new RegExp(`/project/${project.id}/rfis`));
    await expect(sidebar.getByRole("link", { name: /approvals/i })).toHaveAttribute("href", new RegExp(`/project/${project.id}/approvals`));
    const dailyLog = sidebar.getByRole("link", { name: /daily log/i });
    await expect(dailyLog).toBeVisible();
    await expect(dailyLog).toHaveAttribute("href", new RegExp(`/project/${project.id}/schedules/daily-log`));
    await expect(sidebar.getByRole("link", { name: /bim models/i })).toHaveAttribute("href", new RegExp(`/project/${project.id}/bim`));
    await expect(sidebar.getByRole("link", { name: /permits & compliance/i })).toHaveAttribute("href", new RegExp(`/project/${project.id}/permits`));

    // Retired items are absent from the sidebar entirely.
    await expect(sidebar.getByRole("link", { name: /selections/i })).toHaveCount(0);
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
