import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";
import { buildProgrammeXml } from "../fixtures/programme-file";

/**
 * RISK MAP — Import programme dialog on the Project Chart.
 * - Upstream trigger: a PM uploads a Microsoft Project / Excel programme to
 *   populate an empty schedule.
 * - Expected guardrail: on a successful apply the dialog CLOSES, a success
 *   toast confirms the import, and the Gantt chart refreshes in place (the
 *   activities query is invalidated) — no navigation, since the import targets
 *   the current project.
 * - Failure liability (the bug this covers): the dialog used to stay open with
 *   no feedback, so PMs re-ran the upload — which the backend rejects as
 *   "already applied" — leaving them stuck on an apparently-empty chart.
 */
test.describe("Import programme @programme", () => {
  test("applies a programme, closes the dialog, and refreshes the chart", async ({
    page,
    project,
  }) => {
    const nav = new ProjectNav(page, project.id);
    await nav.goto("schedules/project-chart");

    // Fresh project starts empty — the chart shows the import empty state.
    await expect(page.getByText(/no scheduled activities/i)).toBeVisible();

    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: /import programme/i }).first().click();
    await expect(dialog.getByRole("heading", { name: /import programme/i })).toBeVisible();

    // Set files directly on the hidden <input type=file> (no filechooser race).
    const programme = buildProgrammeXml();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: programme.name,
      mimeType: programme.mimeType,
      buffer: programme.buffer,
    });

    // Parsing runs a background job; the dialog polls until it reaches the
    // preview (completed) state, then we apply into the current project.
    const applyButton = dialog.getByRole("button", { name: /import into project/i });
    await expect(applyButton).toBeVisible({ timeout: 30_000 });
    await applyButton.click();

    // Guardrail 1: success toast confirms the import.
    await expect(page.getByText(/programme imported/i)).toBeVisible();

    // Guardrail 2: the dialog is gone (closed on success).
    await expect(dialog).toBeHidden();

    // Guardrail 3: the chart refreshed in place — empty state replaced by the
    // rendered Gantt — and we stayed on the same project's chart route.
    await expect(page.getByText(/no scheduled activities/i)).toBeHidden();
    await expect(page.locator(".bp-gantt")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/project/${project.id}/schedules/project-chart`));
  });
});
