import { test, expect } from "../fixtures/test";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Overall progress bar on the builder/org dashboard.
 * - Upstream trigger: the organization completes a site activity, so
 *   project.progress_percent is recomputed, while a builder has the org
 *   dashboard (all projects) open.
 * - Expected guardrail: an activity mutation refreshes the dashboard progress
 *   bar in the SAME session — the bar reads from the useProjects
 *   `["projects","list"]` query, which useUpdateActivity must invalidate.
 * - Failure liability: the bar stays stale for the 30s query staleTime (bug:
 *   useUpdateActivity did not invalidate projectKeys.list()), so the builder
 *   sees an out-of-date completion percentage across the org's projects.
 *
 * No reload after the change: a reload drops the React Query cache and masks the
 * bug. The test navigates within the SPA so the stale cache is the thing under
 * test, and proves the bar updates through cache invalidation alone.
 */
test.describe("Dashboard overall progress @regression @activities", () => {
  test("dashboard progress refreshes in-session after an activity update @smoke", async ({
    page,
    project,
    api,
  }) => {
    // Suppress the one-off product tour whose modal overlay would block the
    // in-app sidebar navigation this test relies on.
    await page.addInitScript(() => {
      const real = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key: string) {
        return key.startsWith("buildpanda:tour:") ? "1" : real.call(this, key);
      };
    });

    const firstName = uniqueName("Foundations");
    const created = await Promise.all(
      [firstName, uniqueName("Framing")].map((name) =>
        api.postOrThrow<{ id: string }>(`/projects/${project.id}/activities`, {
          name,
          activityType: "Structural",
          plannedStartAt: "2026-01-01T07:00:00.000Z",
          plannedEndAt: "2026-01-08T17:00:00.000Z",
        }),
      ),
    );
    const first = created[0];
    if (!first) throw new Error("activity seeding failed");

    // Only full load in the test: everything after stays in one SPA session so
    // the cached ["projects","list"] survives and its staleness is what we test.
    await page.goto("/dashboard");
    const card = page
      .locator("div")
      .filter({ hasText: project.title })
      .filter({ hasText: "Completion" })
      .last();
    await expect(card).toBeVisible();
    await expect(card.getByText("0%")).toBeVisible();

    const patch = await page.request.patch(
      `http://localhost:3000/projects/${project.id}/activities/${first.id}`,
      { data: { status: "Completed" } },
    );
    expect(patch.ok()).toBeTruthy();

    // Soft-navigation only (link clicks / history) — a document reload here would
    // drop the cache and hide the bug. Editing fires the real useUpdateActivity.
    await card.getByRole("link", { name: /view|open|overview/i }).first().click();
    const activityLink = page.getByRole("link", { name: /site activity/i });
    if (!(await activityLink.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /^schedules$/i }).click();
    }
    await activityLink.click();
    const activityCard = page
      .locator("div")
      .filter({ hasText: firstName })
      .filter({ has: page.getByRole("button", { name: /^edit$/i }) })
      .last();
    await activityCard.getByRole("button", { name: /^edit$/i }).click();
    const nameInput = page.locator("#activity-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(uniqueName("Foundations-done"));
    await page.getByRole("button", { name: /save activity/i }).click();
    await expect(page.getByRole("button", { name: /save activity/i })).toBeHidden();

    // Within the 30s staleTime the bar stays 0% unless the mutation invalidated
    // ["projects","list"]. Return via history (no reload) so the cache is intact.
    for (let i = 0; i < 6 && !page.url().endsWith("/dashboard"); i++) {
      await page.goBack();
    }
    await expect(page).toHaveURL(/\/dashboard$/);
    const refreshed = page
      .locator("div")
      .filter({ hasText: project.title })
      .filter({ hasText: "Completion" })
      .last();
    await expect(refreshed.getByText("50%")).toBeVisible();
  });
});
