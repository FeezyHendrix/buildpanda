import { test, expect } from "../fixtures/test";
import { buildProgrammeXml } from "../fixtures/programme-file";

test.describe("@ux uploaded import recovery", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
      if (message.type() === "warning") console.warn(message.text());
    });
  });

  test("a schedule upload survives refresh, retries lookup and finishes its created project once", async ({ page, api }) => {
    let applies = 0;
    let sessionId = "";
    page.on("request", request => {
      if (request.method() === "POST" && /\/programme\/[^/]+\/apply$/.test(request.url())) applies += 1;
    });
    await page.route("**/import-sessions/*/project", route => {
      sessionId = new URL(route.request().url()).pathname.split("/")[2]!;
      return route.fulfill({ status: 503, json: { message: "Could not finish linking the schedule." } });
    });
    await page.goto("/import");
    await page.getByRole("button", { name: /Start from a programme/ }).click();
    const programme = buildProgrammeXml("UX resumed programme");
    await page.locator('input[type="file"]').setInputFiles({ name: programme.name, mimeType: programme.mimeType, buffer: programme.buffer });
    await expect(page.getByRole("heading", { name: "Review & Create" })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Project Name", { exact: true }).fill("UX resumed programme");
    await page.getByLabel("City", { exact: true }).fill("Lekki");
    await page.getByLabel("State", { exact: true }).fill("Lagos");
    await page.getByLabel("Budget Total", { exact: true }).fill("2000000");
    await page.route("**/projects/import/programme/*", route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Could not load your uploaded schedule" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Failed to process file" })).toHaveCount(0);
    await page.unroute("**/projects/import/programme/*");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByLabel("Project Name", { exact: true })).toHaveValue("UX resumed programme");
    await expect(page.getByLabel("Budget Total", { exact: true })).toHaveValue("2,000,000");
    await page.getByRole("button", { name: "Create Project", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Could not finish linking the schedule");
    const href = await page.getByRole("link", { name: "Open the project already created" }).getAttribute("href");
    const projectId = href!.split("/")[2]!;
    try {
      await page.reload();
      await page.unroute("**/import-sessions/*/project");
      await page.getByRole("button", { name: "Continue with the saved project", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Upload Bill of Quantities (BoQ)" })).toBeVisible();
      expect(applies).toBe(1);
      const session = await api.get<{ projectId: string; documents: { status: string; fileName: string }[] }>(`/import-sessions/${sessionId}`);
      expect(session.body.projectId).toBe(projectId);
      expect(session.body.documents).toMatchObject([{ status: "applied", fileName: programme.name }]);
      await api.postOrThrow(`/import-sessions/${sessionId}/documents`, { kind: "boq", status: "failed", fileName: "needs-correction.csv" });
      await page.goto("/import?step=6");
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Upload Bill of Quantities (BoQ)" })).toBeVisible();
    } finally {
      await api.delete(`/projects/${projectId}`);
    }
  });

  test("file choices survive refresh and a failed final handoff does not reapply the extraction", async ({ page, project, api }) => {
    let sessionId = "";
    let applies = 0;
    let applied = false;
    const jobId = "ux-file-recovery";
    const job = {
      id: jobId, fileName: "project-brief.txt", error: null,
      extraction: { metadata: { projectName: "UX file import", location: "Lagos" }, phases: [], budgetCategories: [], materials: [], sheets: [] },
    };
    // Exercise the frontend with a deterministic extraction response; the
    // session/link/document handoff uses the real API and a disposable project.
    await page.route("**/project-files/extract?*", route => {
      sessionId = new URL(route.request().url()).searchParams.get("sessionId")!;
      return route.fulfill({ status: 202, json: { ...job, status: "completed", projectId: null } });
    });
    await page.route(`**/project-files/extract/${jobId}`, route => route.fulfill({ json: { ...job, status: applied ? "applied" : "completed", projectId: applied ? project.id : null } }));
    await page.route(`**/project-files/extract/${jobId}/apply`, route => {
      applies += 1;
      expect(route.request().postDataJSON().selection.metadata).toBe(false);
      applied = true;
      return route.fulfill({ status: 201, json: { projectId: project.id } });
    });
    await page.route("**/import-sessions/*/documents", route => route.fulfill({ status: 503, json: { message: "Could not finish saving the file record." } }));
    await page.goto("/import");
    await page.getByRole("button", { name: /I have a project file/ }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: job.fileName, mimeType: "text/plain", buffer: Buffer.from("Project brief") });
    await page.getByRole("switch", { name: "Project details", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Project details", exact: true })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Create project from this file", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Could not finish saving the file record");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
    await page.reload();
    await page.unroute("**/import-sessions/*/documents");
    await page.getByRole("button", { name: "Continue with the saved project", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Upload Bill of Quantities (BoQ)" })).toBeVisible();
    expect(applies).toBe(1);
    const session = await api.get<{ projectId: string; documents: { status: string; jobId: string }[] }>(`/import-sessions/${sessionId}`);
    expect(session.body.projectId).toBe(project.id);
    expect(session.body.documents).toMatchObject([{ jobId, status: "applied" }]);
  });
});
