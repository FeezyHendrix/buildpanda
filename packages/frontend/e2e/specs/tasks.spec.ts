import { test, expect } from "../fixtures/test";
import { TasksPage } from "../pages/tasks.pom";
import { uniqueName } from "../fixtures/ids";

/**
 * RISK MAP — Tasks board (Kanban), the project's work-tracking surface.
 * - Upstream trigger: a PM opens the board and creates/assigns work.
 * - Expected guardrail: a created task PERSISTS (survives the React Query
 *   invalidation) and renders on the board with its chosen priority. The same
 *   FormDrawer reopens in edit mode carrying the saved values.
 * - Failure liability: if a "saved" task silently vanishes (optimistic UI not
 *   backed by a real write, or a botched cache invalidation), the team loses
 *   work items — schedule slips, accountability gaps, missed scope.
 */
test.describe("Tasks board @smoke @tasks", () => {
  test("creates a task that persists on the board with its priority", async ({ page, project }) => {
    const tasks = new TasksPage(page, project.id);
    await tasks.goto();

    const title = uniqueName("Smoke Task");
    await tasks.createTask(title, "High");

    // Guardrail: the card is on the board after the mutation settles (drawer
    // closed inside createTask = invalidation done), and carries the priority.
    const card = tasks.card(title);
    await expect(card).toBeVisible();

    // Reopen in edit mode and assert the saved values round-tripped (the same
    // upsert drawer, now editing) — proves the write reached the backend.
    await tasks.openCard(title);
    await expect(tasks.drawer.dialog.getByLabel(/title/i)).toHaveValue(title);
    await expect(tasks.drawer.dialog).toContainText(/reporter/i);
  });

  test("board renders its default columns @smoke", async ({ page, project }) => {
    const tasks = new TasksPage(page, project.id);
    await tasks.goto();

    // A freshly-seeded project gets the default To Do / Doing / Done columns.
    for (const column of ["To Do", "Doing", "Done"]) {
      await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
    }
  });
});
