import { test, expect } from "../fixtures/test";

test.describe("@ux recovering interrupted work", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
      if (message.type() === "warning") console.warn(`Browser warning: ${message.text()}`);
    });
  });

  test("a new task draft survives refresh and is cleared after creation", async ({ page, project }) => {
    await page.goto(`/project/${project.id}/tasks?task=new`);
    await page.getByLabel("Title", { exact: true }).fill("UX recovered new task");
    await page.getByRole("button", { name: "High", exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.reload();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("UX recovered new task");
    await expect(page.getByRole("button", { name: "High", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("UX recovered new task", { exact: true })).toBeVisible();
    await page.goto(`/project/${project.id}/tasks?task=new`);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("");
  });

  test("session expiry returns to the task with unsaved changes intact", async ({ page, context, api, project, roleUser }) => {
    const task = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, { title: "UX before expiry" });
    await page.goto(`/project/${project.id}/tasks?task=${task.id}`);
    await page.getByLabel("Title", { exact: true }).fill("UX after expiry");
    await context.clearCookies();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=/);
    await page.getByRole("textbox", { name: /email/i }).fill(roleUser.email);
    await page.locator('input[type="password"]').fill(roleUser.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("UX after expiry");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await api.get<{ title: string }>(`/projects/${project.id}/tasks/${task.id}`)).body.title).toBe("UX after expiry");
  });

  test("changing only priority asks before discarding and leaves the saved task unchanged", async ({ page, api, project }) => {
    const task = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, { title: "UX priority draft" });
    const target = `/project/${project.id}/tasks?task=${task.id}`;
    await page.goto(target);
    await page.getByRole("button", { name: "High", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discard unsaved changes?" })).toBeVisible();
    await page.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.goto(target);
    await expect(page.getByRole("button", { name: "Medium", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("task links work outside the board filter and unavailable tasks provide a return path", async ({ page, api, project }) => {
    const task = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, { title: "UX unassigned linked task" });
    await page.goto(`/project/${project.id}/tasks?scope=assigned&task=${task.id}`);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("UX unassigned linked task");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto(`/project/${project.id}/tasks?scope=assigned&task=missing-task`);
    await expect(page.getByRole("heading", { name: "Item unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Return to task board", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks\\?scope=assigned$`));
    await expect(page.getByRole("heading", { name: "Item unavailable" })).toBeHidden();
  });

  test("deleting a task with a draft keeps one confirmation and supports retry", async ({ page, api, project }) => {
    const task = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, { title: "UX delete recovery" });
    const endpoint = `**/projects/${project.id}/tasks/${task.id}`;
    await page.goto(`/project/${project.id}/tasks?task=${task.id}`);
    await page.getByLabel("Title", { exact: true }).fill("UX draft before deletion");
    await page.route(endpoint, route => route.request().method() === "DELETE"
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } }) : route.continue());
    await page.getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discard unsaved changes?" })).toHaveCount(0);
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Could not delete task. Please try again.", { exact: true })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.unroute(endpoint);
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/tasks$`));
    expect((await api.get(`/projects/${project.id}/tasks/${task.id}`)).status).toBe(404);
  });

  test("an RFI outside the current filter can be opened and edited", async ({ page, api, project }) => {
    const rfi = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/rfis`, {
      subject: "UX linked open RFI", question: "Confirm the beam detail",
    });
    await page.goto(`/project/${project.id}/rfis?status=Closed&rfi=${rfi.id}`);
    await page.getByRole("button", { name: "Edit RFI", exact: true }).click();
    await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("UX linked open RFI");
    await page.getByLabel("Subject", { exact: true }).fill("UX edited linked RFI");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/rfis\?status=Closed$/);
    expect((await api.get<{ subject: string }>(`/projects/${project.id}/rfis/${rfi.id}`)).body.subject).toBe("UX edited linked RFI");
  });

  test("unavailable RFI links have a return path that fits a mobile screen", async ({ page, project }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/project/${project.id}/rfis?status=Closed&rfi=missing-rfi`);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Item unavailable" })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    await dialog.getByRole("button", { name: "Return to RFIs", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/rfis\?status=Closed$/);
  });

  test("an RFI list failure can be retried and an empty filter can be cleared", async ({ page, api, project }) => {
    await api.postOrThrow(`/projects/${project.id}/rfis`, { subject: "UX RFI list recovery", question: "Confirm material" });
    const endpoint = `**/projects/${project.id}/rfis?status=Closed`;
    await page.route(endpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.goto(`/project/${project.id}/rfis?status=Closed`);
    await expect(page.getByRole("heading", { name: "Could not load RFIs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No RFIs match this filter" })).toHaveCount(0);
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByRole("button", { name: "Clear filter", exact: true }).click();
    await expect(page.getByText("UX RFI list recovery", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/rfis$/);
  });
});
