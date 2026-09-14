import { test, expect } from "../fixtures/test";

test.describe("@ux import and finance recovery", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
      if (message.type() === "warning") console.warn(`Browser warning: ${message.text()}`);
    });
  });

  test("an interrupted import continues with its created project without creating another", async ({ page, api }) => {
    let creations = 0;
    let sessionReads = 0;
    let sessionId = "";
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && path === "/projects") creations += 1;
      if (request.method() === "GET" && /^\/import-sessions\/[^/]+$/.test(path)) sessionReads += 1;
    });
    await page.route("**/import-sessions/*/project", async route => {
      sessionId = new URL(route.request().url()).pathname.split("/")[2]!;
      await route.fulfill({ status: 503, json: { message: "Could not finish linking this import. Please try again." } });
    });
    await page.goto("/import");
    await page.getByText("Start from scratch / details", { exact: true }).click();
    await page.getByLabel("Project Title", { exact: true }).fill("UX import link recovery");
    await page.getByLabel("City", { exact: true }).fill("Lekki");
    await page.getByLabel("State / Region", { exact: true }).fill("Lagos");
    await page.getByPlaceholder("Min", { exact: true }).fill("1000000");
    await page.getByPlaceholder("Max", { exact: true }).fill("2000000");
    const idleReads = sessionReads;
    // Observe longer than two polling intervals: an idle import needs no polling.
    await page.waitForTimeout(3200);
    expect(sessionReads).toBe(idleReads);
    await page.getByRole("button", { name: "Create Project", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your project has been created" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Could not finish linking this import");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
    const projectLink = await page.getByRole("link", { name: "Open the project already created" }).getAttribute("href");
    const projectId = projectLink!.split("/")[2]!;
    try {
      await page.reload();
      await expect(page.getByRole("button", { name: "Create Project", exact: true })).toHaveCount(0);
      await page.unroute("**/import-sessions/*/project");
      await page.getByRole("button", { name: "Continue with the saved project", exact: true }).click();
      await expect(page).toHaveURL(/\/import\?step=3$/);
      expect((await api.get<{ projectId: string }>(`/import-sessions/${sessionId}`)).body.projectId).toBe(projectId);
      expect(creations).toBe(1);
    } finally {
      await api.delete(`/projects/${projectId}`);
    }
  });

  for (const record of [
    { path: "budget-invoices", tab: "invoices", key: "invoice", name: "Invoice", list: "invoices" },
    { path: "expenses", tab: "purchase-orders", key: "po", name: "Purchase order", list: "purchase orders" },
  ]) {
    test(`${record.list} distinguish failed requests and missing links, and let users recover`, async ({ page, project }) => {
      const endpoint = `**/projects/${project.id}/${record.tab}`;
      await page.route(endpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
      await page.goto(`/project/${project.id}/finances/${record.path}?tab=${record.tab}`);
      await expect(page.getByRole("heading", { name: `Could not load ${record.list}` })).toBeVisible();
      await expect(page.getByRole("heading", { name: `No ${record.list} yet` })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Purchase order summary" })).toHaveCount(0);
      await page.unroute(endpoint);
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByRole("heading", { name: `Could not load ${record.list}` })).toBeHidden();
      await expect(page.getByRole("table")).toBeVisible();
      await page.goto(`/project/${project.id}/finances/${record.path}?tab=${record.tab}&${record.key}=missing-record`);
      await expect(page.getByRole("heading", { name: `${record.name} unavailable` })).toBeVisible();
      await page.getByRole("button", { name: `Return to ${record.list}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${record.path}\\?tab=${record.tab}$`));
      await expect(page.getByRole("table")).toBeVisible();
    });
  }

  test("clearing invoice filters removes both filters and preserves the finance tab", async ({ page, api, project }) => {
    await api.postOrThrow(`/projects/${project.id}/invoices`, {
      vendorName: "UX recovered supplier", trade: "Materials", amount: 1000, invoiceType: "vendor",
    });
    await page.goto(`/project/${project.id}/finances/budget-invoices?tab=invoices&status=Paid&q=nomatch`);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(page).toHaveURL(/\/budget-invoices\?tab=invoices$/);
    await expect(page.getByRole("row").filter({ hasText: "UX recovered supplier" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search invoices" })).toHaveValue("");
  });
});
