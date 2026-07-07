import { test, expect } from "../fixtures/test";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Overall progress bar on the client "My Build" portal.
 * - Upstream trigger: a site activity is completed (project.progress_percent
 *   recomputed) while the homeowner has the My Build portal open.
 * - Expected guardrail: an activity mutation refreshes the My Build progress bar
 *   in the SAME session — the bar reads from the useMyProjects
 *   `["me","projects"]` query, which useUpdateActivity must invalidate.
 * - Failure liability: the bar stays stale for the 30s query staleTime (bug:
 *   useUpdateActivity did not invalidate participantKeys.myProjects()), so the
 *   homeowner keeps seeing an out-of-date completion percentage.
 *
 * No reload after the change: a reload drops the React Query cache and masks the
 * bug. The test navigates within the SPA so the stale cache is the thing under
 * test, and proves the bar updates through cache invalidation alone.
 */
test.describe("My Build overall progress @regression @activities", () => {
  test("progress bar refreshes in-session after an activity update @smoke", async ({
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
    // the cached ["me","projects"] survives and its staleness is what we test.
    await page.goto("/my-build");
    const baseline = page.locator("a", { hasText: project.title }).first();
    await expect(baseline).toBeVisible();
    await expect(baseline.getByText("0%")).toBeVisible();

    const patch = await page.request.patch(
      `http://localhost:3000/projects/${project.id}/activities/${first.id}`,
      { data: { status: "Completed" } },
    );
    expect(patch.ok()).toBeTruthy();

    // Soft-navigation only (link clicks / history) — a document reload here would
    // drop the cache and hide the bug. Editing fires the real useUpdateActivity.
    await baseline.click();
    const activityLink = page.getByRole("link", { name: /site activity/i });
    if (!(await activityLink.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /^schedules$/i }).click();
    }
    await activityLink.click();
    const card = page
      .locator("div")
      .filter({ hasText: firstName })
      .filter({ has: page.getByRole("button", { name: /^edit$/i }) })
      .last();
    await card.getByRole("button", { name: /^edit$/i }).click();
    const nameInput = page.locator("#activity-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(uniqueName("Foundations-done"));
    await page.getByRole("button", { name: /save activity/i }).click();
    await expect(page.getByRole("button", { name: /save activity/i })).toBeHidden();

    // Within the 30s staleTime the bar stays 0% unless the mutation invalidated
    // ["me","projects"]. Return via history (no reload) so the cache is intact.
    for (let i = 0; i < 6 && !page.url().endsWith("/my-build"); i++) {
      await page.goBack();
    }
    await expect(page).toHaveURL(/\/my-build$/);
    const refreshed = page.locator("a", { hasText: project.title }).first();
    await expect(refreshed.getByText("50%")).toBeVisible();
  });
});
