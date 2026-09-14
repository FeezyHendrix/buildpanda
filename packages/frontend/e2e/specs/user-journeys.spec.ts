import { test, expect } from "../fixtures/test";

test.describe("@ux user journey continuity", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
  });

  for (const location of [
    { country: "Nigeria", state: "Lagos", city: "Lekki", address: "Lekki, Lagos, Nigeria" },
    { country: "Canada", state: "Ontario", city: "Toronto", address: "Toronto, Ontario, Canada" },
    { country: "Singapore", state: "", city: "Marina Bay", address: "Marina Bay, Singapore" },
  ]) {
    test(`the original creation wizard resumes and saves a project in ${location.country}`, async ({ page, api }) => {
      const consoleIssues: string[] = [];
      page.on("console", message => {
        if (["error", "warning"].includes(message.type())) consoleIssues.push(message.text());
      });
      await page.goto("/project/create");
      await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Invest in Real Estate/ })).toHaveCount(0);
      await page.getByRole("button", { name: /Build a Home/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: /New build home/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByText("Verify on map", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Country", exact: true })).toHaveText("Select country");
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
      await page.getByRole("combobox", { name: "Country", exact: true }).click();
      await page.getByPlaceholder("Search countries…").fill(location.country);
      await page.getByRole("option", { name: location.country, exact: true }).click();
      await page.getByLabel("State, Region or Province", { exact: true }).fill(location.state);
      await page.getByPlaceholder("Enter city or area").fill(location.city);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Project Location" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Country", exact: true })).toHaveText(location.country);
      await expect(page.getByLabel("State, Region or Province", { exact: true })).toHaveValue(location.state);
      await expect(page.getByPlaceholder("Enter city or area")).toHaveValue(location.city);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: /Residential Home/ }).click();
      await page.getByRole("button", { name: "12 – 18 months", exact: true }).click();
      await page.getByRole("button", { name: /Full Funding/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: /I Have Contractors/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByLabel("Project title", { exact: true }).fill("UX original wizard");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByText(`UX original wizard at ${location.address}`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Start Your Project", exact: true }).click();
      await page.waitForURL(/\/project\/[^/]+\/overview/);
      const id = new URL(page.url()).pathname.split("/")[2]!;
      try {
        const saved = await api.get<{ name: string; address: string }>(`/projects/${id}`);
        expect(saved.body.name).toBe("UX original wizard");
        expect(saved.body.address).toBe(location.address);
        expect((await api.get<unknown[]>(`/projects/${id}/stages`)).body).toHaveLength(7);
        expect(consoleIssues).toEqual([]);
      } finally {
        await api.delete(`/projects/${id}`);
      }
    });
  }

  test("changing country clears the previous location and requires a new city", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/project/create");
    await page.getByRole("button", { name: /Civil \/ Infrastructure/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const country = page.getByRole("combobox", { name: "Country", exact: true });
    const region = page.getByLabel("State, Region or Province", { exact: true });
    const city = page.getByPlaceholder("Enter city or area");
    const next = page.getByRole("button", { name: "Continue", exact: true });
    await country.click();
    await page.getByPlaceholder("Search countries…").fill("Nigeria");
    await page.getByRole("option", { name: "Nigeria", exact: true }).click();
    await region.fill("Lagos");
    await city.fill("Lekki");
    await expect(next).toBeEnabled();
    await country.click();
    await page.getByPlaceholder("Search countries…").fill("Canada");
    await page.getByRole("option", { name: "Canada", exact: true }).click();
    await expect(region).toHaveValue("");
    await expect(city).toHaveValue("");
    await expect(next).toBeDisabled();
    await page.goto("/project/create?step=review");
    await expect(page).toHaveURL(/step=3$/);
    await city.fill("Toronto");
    await next.click();
    await expect(page).toHaveURL(/step=4$/);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(country).toHaveText("Canada");
    await expect(city).toHaveValue("Toronto");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("project type controls templates and changing it clears the previous choice", async ({ page }) => {
    await page.goto("/project/create");
    await page.getByRole("button", { name: /Renovate a Property/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose a renovation template" })).toBeVisible();
    await expect(page.getByRole("button", { name: /New build home/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Interior fit-out/ })).toBeVisible();
    await page.getByRole("button", { name: /Extension/ }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: /Extension/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: /Build a Home/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose a home-building template" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Extension/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Start blank/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: /Civil \/ Infrastructure/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project Location" })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("button", { name: /Civil \/ Infrastructure/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("a named reviewer can decide from the linked detail", async ({ page, api, project, roleUser }) => {
    const approval = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/approvals`, {
      title: "UX named review", category: "Finishes", requestedReviewerId: roleUser.userId,
    });
    await page.goto(`/project/${project.id}/approvals?approval=${approval.id}`);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "UX named review" })).toBeVisible();
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(dialog).toBeHidden();
    const saved = await api.get<{ status: string }>(`/projects/${project.id}/approvals/${approval.id}`);
    expect(saved.body.status).toBe("Approved");
  });

  test("requesting changes needs a note and keeps the decision open", async ({ page, api, project, roleUser }) => {
    const approval = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/approvals`, {
      title: "UX revision", requestedReviewerId: roleUser.userId,
    });
    await page.goto(`/project/${project.id}/approvals?approval=${approval.id}`);
    await page.getByRole("dialog").getByRole("button", { name: "Request changes", exact: true }).click();
    await expect(page.getByText("Add a decision note so the requester knows what to change.")).toBeVisible();
    expect((await api.get<{ status: string }>(`/projects/${project.id}/approvals/${approval.id}`)).body.status).toBe("Pending");
  });

  test("an overdue alert preserves its filter on refresh", async ({ page, api, project, roleUser }) => {
    const overdue = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/rfis`, {
      subject: "UX overdue question", question: "Confirm the detail", ballInCourtId: roleUser.userId, dueDate: "2020-01-01",
    });
    await api.postOrThrow(`/projects/${project.id}/rfis`, {
      subject: "UX future question", question: "Confirm another detail", ballInCourtId: roleUser.userId, dueDate: "2099-01-01",
    });
    await page.goto(`/project/${project.id}/rfis?status=overdue`);
    await expect(page.getByText("UX overdue question", { exact: true })).toBeVisible();
    await expect(page.getByText("UX future question", { exact: true })).toBeHidden();
    await page.reload();
    await expect(page.getByText("UX overdue question", { exact: true })).toBeVisible();
    await page.goto(`/project/${project.id}/rfis?rfi=${overdue.id}`);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("sign-in returns to the original task", async ({ page, context, api, project, roleUser }) => {
    const task = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/tasks`, { title: "UX return task" });
    await context.clearCookies();
    const target = `/project/${project.id}/tasks?task=${task.id}`;
    await page.goto(target);
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=/);
    await page.getByRole("textbox", { name: /email/i }).fill(roleUser.email);
    await page.locator('input[type="password"]').fill(roleUser.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(new RegExp(`tasks\\?task=${task.id}`));
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("failed project loads show recovery rather than an empty workspace", async ({ page }) => {
    await page.route("**/projects", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Temporarily unavailable"}' }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Could not load projects" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Welcome to Build Panda", { exact: true })).toBeHidden();
    await page.unroute("**/projects");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Could not load projects" })).toBeHidden();
  });

  test("unsaved form dismissal can be cancelled", async ({ page, project }) => {
    await page.goto(`/project/${project.id}/approvals`);
    await page.getByRole("button", { name: "Submit for approval", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("textbox").first().fill("UX unsaved approval");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discard unsaved changes?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("textbox").first()).toHaveValue("UX unsaved approval");
  });

  test("import answers survive a refresh", async ({ page }) => {
    await page.goto("/import");
    await page.getByText("Start from scratch / details", { exact: true }).click();
    await page.getByLabel("Project Title", { exact: true }).fill("UX resumed import");
    await page.reload();
    await expect(page.getByLabel("Project Title", { exact: true })).toHaveValue("UX resumed import");
  });

  test("project invite signup does not ask clients to pick a profession", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/auth/sign-up?email=client%40example.test&redirect=%2Faccept-project-invite%2Fexample-token");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByText("Who is creating this account?", { exact: true })).toBeHidden();
    await expect(page.getByRole("textbox", { name: /email/i })).toHaveValue("client@example.test");
  });
});
