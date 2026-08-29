import { test, expect } from "../fixtures/test";
import { ProjectNav } from "../pages/project-nav";
import { uniqueName } from "../fixtures/ids";

test.describe("Project Chart @regression @schedule", () => {
  test("renders from build stages and key dates before a programme import @smoke", async ({ page, project, api }) => {
    await api.postOrThrow(`/projects/${project.id}/stages`, {
      name: uniqueName("Foundations"),
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-14T00:00:00.000Z",
      progressPercent: 25,
    });
    await api.postOrThrow(`/projects/${project.id}/key-dates`, {
      label: uniqueName("Practical completion"),
      targetDate: "2026-10-01T00:00:00.000Z",
      status: "Upcoming",
    });

    const nav = new ProjectNav(page, project.id);
    await nav.goto("schedules/project-chart");

    await expect(page.getByText(/no scheduled activities/i)).toBeHidden();
    await expect(page.locator(".bp-gantt")).toBeVisible();
  });
});
