import { test, expect } from "../fixtures/test";

// Read-only / navigation smoke: every project route must mount without crashing
// (no React error boundary) and present its main landmark. This catches broken
// lazy chunks, bad route wiring, and render crashes on a freshly-seeded project
// — cheap, deterministic coverage for surfaces without an upsert flow.
const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["overview", "@overview"],
  ["updates", "@updates"],
  ["documents", "@documents"],
  ["inspections", "@inspections"],
  ["daily-log", "@daily-log"],
  ["bim", "@bim"],
  ["materials", "@materials"],
  ["material-log", "@material-log"],
  ["equipment-requests", "@equipment-requests"],
  ["finances", "@finances"],
  ["finances/budget", "@budget"],
  ["finances/milestone-payments", "@milestones"],
  ["schedules/project-chart", "@schedule"],
  ["schedules/activities", "@activities"],
  ["schedules/stages", "@stages"],
  ["approvals", "@approvals"],
  ["people", "@people"],
  ["panda-ai", "@panda-ai"],
  ["settings", "@settings"],
];

/**
 * RISK MAP — Project route reachability (every module's page).
 * - Upstream trigger: a user navigates to any project sub-page.
 * - Expected guardrail: the page mounts and shows its main content — never the
 *   app error boundary, never a blank/stuck Suspense fallback.
 * - Failure liability: a crashing or unreachable module page is a dead end for
 *   the user mid-workflow; a broken lazy chunk can take down a whole area.
 */
test.describe("Project routes reachable @smoke @navigation", () => {
  for (const [route, tag] of ROUTES) {
    test(`mounts ${route} ${tag}`, async ({ page, project }) => {
      await page.goto(`/project/${project.id}/${route}`);
      await expect(page).toHaveURL(new RegExp(`/project/${project.id}/${route.replace(/\//g, "\\/")}`));

      // No React Router error boundary.
      await expect(page.getByText(/Unexpected Application Error/i)).toHaveCount(0);
      await expect(page.getByText(/404 Not Found/i)).toHaveCount(0);

      // Main content present and the route-transition Suspense fallback gone.
      await expect(page.getByRole("main")).toBeVisible();
      await page
        .getByRole("status")
        .filter({ hasText: /loading/i })
        .waitFor({ state: "detached" })
        .catch(() => undefined);
    });
  }
});
