import { test, expect } from "../fixtures/test";
import { db, closeDb } from "../fixtures/db";
import { provisionUser } from "../fixtures/auth";
import { uniqueEmail } from "../fixtures/ids";
import { env } from "../config/env";
import type { ApiClient } from "../fixtures/api-client";

async function inviteClient(api: ApiClient, projectId: string, email: string) {
  const participant = await api.postOrThrow<{ id: string }>(`/projects/${projectId}/participants/invite`, { email, role: "client" });
  const row = await db()("project_participants").where({ id: participant.id }).first<{ invite_token: string }>();
  return row!.invite_token;
}

test.describe("@ux client invitations", () => {
  test.afterAll(closeDb);
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", error => { throw error; });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
      if (message.type() === "warning") console.warn(message.text());
    });
  });

  test("a temporary invitation failure can be retried without calling the invite invalid", async ({ page, context, api, project }) => {
    const token = await inviteClient(api, project.id, uniqueEmail("invite-retry"));
    await context.clearCookies();
    const endpoint = `**/project-invites/${token}`;
    await page.route(endpoint, route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
    await page.goto(`/accept-project-invite/${token}`);
    await expect(page.getByRole("heading", { name: "Could not load this invitation" })).toBeVisible();
    await expect(page.getByText(/invitation is invalid/)).toHaveCount(0);
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  });

  test("switching to the invited account preserves the invite and failed acceptance waits for retry", async ({ page, api, project }) => {
    const client = await provisionUser("invited-client");
    const token = await inviteClient(api, project.id, client.email);
    let attempts = 0;
    const endpoint = `**/project-invites/${token}/accept`;
    await page.route(endpoint, route => {
      attempts += 1;
      return route.fulfill({ status: 503, json: { message: "Could not join. Please try again." } });
    });
    await page.goto(`/accept-project-invite/${token}`);
    await page.getByRole("button", { name: "Use invited account", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=/);
    await page.getByLabel("Email address", { exact: true }).fill(client.email);
    await page.getByLabel("Password", { exact: true }).fill(client.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Could not join");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(1200);
    expect(attempts).toBe(1);
    await page.unroute(endpoint);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
    const participants = await api.get<{ email: string; status: string }[]>(`/projects/${project.id}/participants`);
    expect(participants.body.find(participant => participant.email === client.email)?.status).toBe("active");
    await page.goto(`/project/${project.id}/finances/expenses`);
    await expect(page.getByRole("heading", { name: "Costs are not shared on this project" })).toBeVisible();
  });

  test("a new invited client signs up as an owner and reaches the intended project", async ({ page, context, api, project }) => {
    const email = uniqueEmail("new-client");
    const token = await inviteClient(api, project.id, email);
    await context.clearCookies();
    await page.goto(`/accept-project-invite/${token}`);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByText("Who is creating this account?", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
    await page.getByLabel("Full name", { exact: true }).fill("UX invited client");
    await page.getByLabel("Password", { exact: true }).fill(env.password);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    const user = await db()("user").where({ email }).first<{ id: string; accountType: string }>();
    expect(user?.accountType).toBe("project_owner");
    // Local audit email delivery is disabled; complete the existing fixture's
    // verification step, then exercise sign-in and real invitation acceptance.
    await db()("user").where({ id: user!.id }).update({ emailVerified: true });
    await page.goto(`/auth/sign-in?redirect=${encodeURIComponent(`/accept-project-invite/${token}`)}`);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(env.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
    await expect(page.getByRole("main")).toBeVisible();
    const participant = await db()("project_participants").where({ project_id: project.id, user_id: user!.id }).first<{ status: string }>();
    expect(participant?.status).toBe("active");
  });
});
