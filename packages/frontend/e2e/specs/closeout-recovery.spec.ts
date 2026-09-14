import { test, expect } from "../fixtures/test";

test.describe("@ux financial closeout recovery", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
      if (message.type() === "warning") console.warn(message.text());
    });
  });

  test("final-account and ledger failures offer independent retries", async ({ page, project }) => {
    const summaryEndpoint = `**/projects/${project.id}/finances/summary`;
    const ledgerEndpoint = `**/projects/${project.id}/finances`;
    await page.route(summaryEndpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.route(ledgerEndpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.goto(`/project/${project.id}/finances/contracts-phases?drawer=main&view=final-account`);
    await expect(page.getByRole("heading", { name: "Could not load the final account" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No finance data yet" })).toHaveCount(0);
    await page.unroute(summaryEndpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("region", { name: "Final account summary", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Could not load funding activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No funding activity recorded" })).toHaveCount(0);
    await page.unroute(ledgerEndpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Funding activity", exact: true })).toBeVisible();
  });

  test("a failed payment lookup never displays zero totals and retry restores the real receipt", async ({ page, project, api }) => {
    const invoice = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/invoices`, {
      vendorName: "UX receipt lookup", trade: "Materials", amount: 1000, status: "Approved", invoiceType: "vendor", number: "UX-RECEIPT",
    });
    await api.postOrThrow(`/projects/${project.id}/invoices/${invoice.id}/payments`, { amount: 400, method: "Cash", note: "UX recorded receipt" });
    const endpoint = `**/projects/${project.id}/invoices/payments`;
    await page.route(endpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.goto(`/project/${project.id}/finances/budget-invoices?tab=payments&q=UX-RECEIPT`);
    await expect(page.getByRole("heading", { name: "Could not load invoice payments" })).toBeVisible();
    await expect(page.getByLabel("Payment totals", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No invoice payments yet" })).toHaveCount(0);
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByLabel("Payment totals", { exact: true })).toBeVisible();
    await page.getByText("UX recorded receipt", { exact: true }).click();
    expect(new URL(page.url()).searchParams.get("invoice")).toBe(invoice.id);
    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goto(`/project/${project.id}/finances/budget-invoices?tab=payments&q=UX-RECEIPT&invoice=missing`);
    await page.getByRole("button", { name: "Return to payments", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("tab")).toBe("payments");
    await expect(page.getByRole("searchbox", { name: "Search invoice payments" })).toHaveValue("UX-RECEIPT");
  });

  test("the closing checklist opens receipts and updates after a failed payment is retried", async ({ page, project, api }) => {
    await api.postOrThrow(`/projects/${project.id}/finances/contract-sum`, { contractSum: 2000 });
    const invoice = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/invoices`, {
      vendorName: "UX closeout client", trade: "Construction", amount: 2000, status: "Approved", invoiceType: "progress", direction: "receivable", number: "UX-CLOSEOUT",
      retentionRate: 0, vatRate: 0,
    });
    const accountPath = `/project/${project.id}/finances/contracts-phases?drawer=main&view=final-account`;
    await page.goto(accountPath);
    const receiptStep = page.getByRole("listitem").filter({ hasText: "Record the final receipt" });
    await receiptStep.getByRole("link", { name: "Open related records" }).click();
    await expect(page).toHaveURL(/tab=payments/);
    await page.getByRole("button", { name: "Add payment", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Add payment", exact: true });
    await drawer.getByLabel("Invoice", { exact: true }).selectOption(invoice.id);
    await drawer.getByLabel("Amount", { exact: true }).fill("2000");
    await drawer.getByLabel("Note", { exact: true }).fill("UX final receipt");
    const endpoint = `**/projects/${project.id}/invoices/${invoice.id}/payments`;
    await page.route(endpoint, route => route.fulfill({ status: 503, json: { message: "Please retry the receipt" } }));
    await drawer.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(drawer.getByText("Please retry the receipt", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(drawer.getByLabel("Note", { exact: true })).toHaveValue("UX final receipt");
    await page.unroute(endpoint);
    await drawer.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(drawer).toBeHidden();
    await page.goto(accountPath);
    await expect(page.getByRole("region", { name: "Final account", exact: true })).toContainText("Settled");
    await expect(receiptStep.getByRole("link")).toHaveCount(0);
    await page.getByRole("link", { name: "View invoice payments", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search invoice payments" }).fill("UX-CLOSEOUT");
    await expect(page.getByText("UX final receipt", { exact: true })).toBeVisible();
    const invoices = (await api.get<{ id: string; amountPaid: number }[]>(`/projects/${project.id}/invoices`)).body;
    expect(invoices.find(item => item.id === invoice.id)?.amountPaid).toBe(2000);
  });

  test("budget allocations retain edits during refresh and retry a failed save", async ({ page, api, project }) => {
    const category = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/budget/categories`, { name: "UX allocation category", planned: 2000 });
    const invoice = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/invoices`, {
      vendorName: "UX allocation supplier", trade: "Materials", amount: 1000, status: "Approved", invoiceType: "vendor", number: "UX-ALLOCATION", retentionRate: 10, vatRate: 0,
    });
    const endpoint = `/projects/${project.id}/invoices/${invoice.id}/allocations`;
    expect((await api.put(endpoint, { allocations: [{ budgetCategoryId: category.id, amount: 200 }] })).ok).toBe(true);
    await page.goto(`/project/${project.id}/finances/budget-invoices?tab=invoices&invoice=${invoice.id}`);
    const allocations = page.getByRole("region", { name: "Budget allocations", exact: true });
    const amount = allocations.getByRole("textbox", { name: "Allocated amount 1" });
    await expect(amount).toHaveValue("200");
    await amount.fill("950");
    await expect(allocations.getByRole("button", { name: "Save allocations" })).toBeDisabled();
    await amount.fill("350");
    // The app reuses fresh queries for 30 seconds; reconnect should refresh stale data.
    await page.clock.setFixedTime(new Date(Date.now() + 31_000));
    const refreshed = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === "GET");
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await refreshed;
    await expect(amount).toHaveValue("350");
    await page.route(`**${endpoint}`, route => route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { message: "Retry saving allocations" } }) : route.continue());
    await allocations.getByRole("button", { name: "Save allocations" }).click();
    await expect(allocations.getByRole("alert")).toContainText("Retry saving allocations");
    await expect(amount).toHaveValue("350");
    await page.unroute(`**${endpoint}`);
    await allocations.getByRole("button", { name: "Save allocations" }).click();
    await expect(allocations.getByRole("status")).toContainText("Budget allocations saved");
    expect((await api.get<{ budgetCategoryId: string; amount: number }[]>(endpoint)).body).toEqual([{ budgetCategoryId: category.id, amount: 350 }]);
    await page.reload();
    await expect(amount).toHaveValue("350");
  });
});
