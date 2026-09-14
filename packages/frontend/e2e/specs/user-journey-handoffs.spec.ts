import { test, expect } from "../fixtures/test";

test.describe("@ux journey handoffs", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
  });

  test("global message links open their channel without repeating read requests while typing", async ({ page, api, project }) => {
    const channels = await api.get<{ id: string }[]>(`/projects/${project.id}/channels`);
    const channelId = channels.body[0]!.id;
    const message = await api.postOrThrow<{ id: string }>(`/channels/${channelId}/messages`, { body: "UX linked message" });
    await api.postOrThrow(`/messages/${message.id}/pin`, {});
    const readRequests: string[] = [];
    page.on("request", request => {
      if (request.method() === "PATCH" && request.url().endsWith(`/channels/${channelId}/members/me`)) {
        readRequests.push(request.url());
      }
    });
    await page.goto(`/messages?channel=${channelId}&message=${message.id}`);
    const linkedMessage = page.locator(`#message-${message.id}`);
    await expect(linkedMessage).toBeVisible();
    await expect.poll(() => readRequests.length).toBe(1);
    const composer = page.locator("textarea").last();
    await composer.fill("An unsent reply");
    await composer.pressSequentially(" that keeps focus");
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue("An unsent reply that keeps focus");
    await page.getByRole("button", { name: /1 Pinned/ }).click();
    await expect(composer).toHaveValue("An unsent reply that keeps focus");
    expect(readRequests).toHaveLength(1);
    await expect(linkedMessage).toBeVisible();
  });

  test("assigned reviews link from the personal queue and disappear after a decision", async ({ page, api, project, roleUser }) => {
    const approval = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/approvals`, {
      title: "UX queue decision", requestedReviewerId: roleUser.userId,
    });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /UX queue decision/ }).click();
    await expect(page).toHaveURL(new RegExp(`approval=${approval.id}`));
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Needs my action" })).toBeVisible();
    await expect(page.getByRole("link", { name: /UX queue decision/ })).toBeHidden();
  });

  test("activity links show the exact record and allow editing", async ({ page, api, project }) => {
    const activity = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/activities`, {
      name: "UX linked activity", activityType: "construction",
      plannedStartAt: "2026-09-15", plannedEndAt: "2026-09-20",
    });
    await page.goto(`/project/${project.id}/schedules/activities/${activity.id}`);
    await expect(page.getByRole("heading", { name: "UX linked activity" })).toBeVisible();
    await page.getByRole("button", { name: "Update activity", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByPlaceholder("e.g. Slab pour, Floor 2")).toHaveValue("UX linked activity");
  });

  test("disabled features explain the destination without silently redirecting", async ({ page, project }) => {
    await page.route("**/feature-flags", async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.flags = data.flags.map((flag: { key: string; enabled: boolean }) =>
        flag.key === "workflow.rfis" ? { ...flag, enabled: false } : flag);
      await route.fulfill({ response, json: data });
    });
    await page.goto(`/project/${project.id}/rfis`);
    await expect(page.getByRole("heading", { name: "This feature is unavailable" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/project/${project.id}/rfis$`));
    await page.getByRole("link", { name: "Return to workspace" }).click();
    await expect(page).not.toHaveURL(/\/rfis$/);
  });

  test("raising a PO opens the draft and issuing it refreshes the open drawer", async ({ page, api, project }) => {
    await api.postOrThrow(`/projects/${project.id}/materials/orders`, {
      title: "UX concrete request", materialName: "UX concrete", quantity: 10,
      unit: "m3", neededBy: "2026-09-20", supplier: "UX supplier", status: "Approved", unitRate: 100,
    });
    await page.goto(`/project/${project.id}/materials`);
    await page.getByRole("button", { name: "Actions for UX concrete", exact: true }).click();
    await page.getByRole("menuitem", { name: "Raise a purchase order", exact: true }).click();
    await page.getByRole("button", { name: "Raise PO", exact: true }).click();
    await expect(page).toHaveURL(/tab=purchase-orders&po=/);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("UX supplier", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Issue to vendor", exact: true }).click();
    await expect(dialog.getByText("Issued", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Issue to vendor", exact: true })).toBeHidden();
  });

  test("a mobile capture survives failed posting and refresh", async ({ page, project }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/project/${project.id}/overview`);
    await page.getByRole("button", { name: "Skip tour", exact: true }).click();
    await page.getByRole("button", { name: "Capture from site", exact: true }).click();
    const note = page.getByPlaceholder("Add a short note (optional)");
    await note.fill("UX saved site note");
    await page.route("**/daily-logs/**", route => route.fulfill({ status: 503, json: { error: "Connection lost" } }));
    await page.getByRole("button", { name: "Post to daily log", exact: true }).click();
    await expect(page.getByText("Could not post your capture", { exact: true })).toBeVisible();
    await expect(note).toHaveValue("UX saved site note");
    await page.getByRole("button", { name: "Save for later", exact: true }).click();
    await page.unroute("**/daily-logs/**");
    await page.reload();
    await page.getByRole("button", { name: "Capture from site", exact: true }).click();
    await expect(note).toHaveValue("UX saved site note");
    await page.getByRole("button", { name: "Post to daily log", exact: true }).click();
    await expect(page.getByText("Added to today's daily log", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "Capture from site", exact: true }).click();
    await expect(note).toHaveValue("");
  });
});
