import { createEmailVerificationToken } from "better-auth/api";
import { test, expect } from "../fixtures/test";
import { ApiClient } from "../fixtures/api-client";
import { provisionUser } from "../fixtures/auth";
import { db, closeDb } from "../fixtures/db";
import { uniqueEmail } from "../fixtures/ids";
import { seedProject, teardownProject } from "../fixtures/seed";
import { env } from "../config/env";

test.describe("@ux account recovery", () => {
  test.afterAll(closeDb);
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    const watch = (target: typeof page) => {
      target.on("pageerror", error => { throw error; });
      target.on("console", message => {
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) throw new Error(message.text());
        if (message.type() === "warning") console.warn(message.text());
      });
    };
    watch(page);
    context.on("page", watch);
  });

  test("an invited client recovers an expired link and verifies in a new tab without losing the project", async ({ page, context, api, project }) => {
    const email = uniqueEmail("verify-client");
    const participant = await api.postOrThrow<{ id: string }>(`/projects/${project.id}/participants/invite`, { email, role: "client" });
    const row = await db()("project_participants").where({ id: participant.id }).first<{ invite_token: string }>();
    await page.goto(`/accept-project-invite/${row!.invite_token}`);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByLabel("Full name", { exact: true }).fill("UX verification client");
    await page.getByLabel("Password", { exact: true }).fill(env.password);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);

    // Exercise the real verification endpoint with a locally signed test token.
    // Email delivery is disabled on the audit server.
    const expired = await createEmailVerificationToken(env.authSecret, email, undefined, -10);
    await page.goto(`/auth/verify-email?token=${expired}`);
    await expect(page.getByRole("heading", { name: "Verification link expired or invalid" })).toBeVisible();
    const resendEndpoint = "**/api/auth/send-verification-email";
    await page.route(resendEndpoint, route => route.fulfill({ status: 503, json: { message: "Please retry sending" } }));
    await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Please retry sending");
    await page.unroute(resendEndpoint);
    await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Verification email sent");
    await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();

    const linkedPage = await context.newPage();
    const valid = await createEmailVerificationToken(env.authSecret, email);
    let attempts = 0;
    const verifyEndpoint = "**/api/auth/verify-email?*";
    await linkedPage.route(verifyEndpoint, route => {
      attempts += 1;
      return route.fulfill({ status: 503, json: { message: "Unavailable" } });
    });
    await linkedPage.goto(`/auth/verify-email?token=${valid}`);
    await expect(linkedPage.getByRole("heading", { name: "Could not verify your email" })).toBeVisible();
    await linkedPage.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); });
    await linkedPage.waitForTimeout(1200);
    expect(attempts).toBe(1);
    await linkedPage.unroute(verifyEndpoint);
    await linkedPage.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(linkedPage).toHaveURL(new RegExp(`/project/${project.id}/overview$`));
    const user = await db()("user").where({ email }).first<{ emailVerified: boolean }>();
    expect(user?.emailVerified).toBe(true);
    expect((await db()("project_participants").where({ id: participant.id }).first<{ status: string }>())?.status).toBe("active");
    expect(await linkedPage.evaluate(() => localStorage.getItem("auth-recovery:v1:verification"))).toBeNull();
  });

  test("an unverified sign-in leads to a usable resend form with the return link intact", async ({ page }) => {
    const email = uniqueEmail("unverified-signin");
    await new ApiClient().postOrThrow("/api/auth/sign-up/email", { name: "UX unverified account", email, password: env.password, accountType: "project_owner" });
    const target = "/my-build?from=shared";
    await page.goto(`/auth/sign-in?redirect=${encodeURIComponent(target)}`);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(env.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
    await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Verification email sent");
    await page.getByRole("banner").getByRole("link", { name: "Sign In", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(target);
  });

  test("password recovery survives failed requests and a new tab, then returns to the original project", async ({ page, context }) => {
    const user = await provisionUser("password-recovery");
    const ownApi = new ApiClient();
    ownApi.setCookie(user.cookie);
    const project = await seedProject(ownApi, "Password recovery");
    const target = `/project/${project.id}/overview?from=shared#progress`;
    try {
      await page.goto(`/auth/sign-in?redirect=${encodeURIComponent(target)}`);
      await page.getByRole("link", { name: "Forgot password?" }).click();
      await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(target);
      await page.getByLabel("Email address", { exact: true }).fill(user.email);
      const requestEndpoint = "**/api/auth/request-password-reset";
      await page.route(requestEndpoint, route => route.fulfill({ status: 503, json: { message: "Try the request again" } }));
      await page.getByRole("button", { name: "Send reset link", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Try the request again");
      await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(user.email);
      await page.unroute(requestEndpoint);
      await page.getByRole("button", { name: "Send reset link", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      const reset = await db()("verification").where({ value: user.userId }).whereLike("identifier", "reset-password:%")
        .orderBy("createdAt", "desc").first<{ identifier: string }>();
      const token = reset!.identifier.slice("reset-password:".length);
      const linkedPage = await context.newPage();
      await linkedPage.goto(`/auth/reset-password?token=${token}`);
      const password = `${env.password}-updated`;
      await linkedPage.getByLabel("New password", { exact: true }).fill(password);
      await linkedPage.getByLabel("Confirm password", { exact: true }).fill(`${password}-mismatch`);
      await linkedPage.getByRole("button", { name: "Reset Password", exact: true }).click();
      await expect(linkedPage.getByRole("alert")).toContainText("Passwords do not match");
      await linkedPage.getByLabel("Confirm password", { exact: true }).fill(password);
      const resetEndpoint = "**/api/auth/reset-password";
      await linkedPage.route(resetEndpoint, route => route.fulfill({ status: 503, json: { message: "Try resetting again" } }));
      await linkedPage.getByRole("button", { name: "Reset Password", exact: true }).click();
      await expect(linkedPage.getByRole("alert")).toContainText("Try resetting again");
      await expect(linkedPage.getByLabel("New password", { exact: true })).toHaveValue(password);
      await linkedPage.unroute(resetEndpoint);
      await linkedPage.getByRole("button", { name: "Reset Password", exact: true }).click();
      await expect(linkedPage.getByRole("heading", { name: "Password reset successfully" })).toBeVisible();
      await linkedPage.getByRole("button", { name: "Sign in", exact: true }).click();
      expect(new URL(linkedPage.url()).searchParams.get("redirect")).toBe(target);
      await linkedPage.getByLabel("Email address", { exact: true }).fill(user.email);
      await linkedPage.getByLabel("Password", { exact: true }).fill(password);
      await linkedPage.getByRole("button", { name: "Sign In", exact: true }).click();
      await expect(linkedPage).toHaveURL(`${env.baseUrl}${target}`);
    } finally { await teardownProject(ownApi, project.id); }
  });

  test("invalid reset links offer a fresh request and reject an external return destination", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/reset-password?token=invalid&redirect=https://example.com");
    await page.getByLabel("New password", { exact: true }).fill(env.password);
    await page.getByLabel("Confirm password", { exact: true }).fill(env.password);
    await page.getByRole("button", { name: "Reset Password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reset link expired or invalid" })).toBeVisible();
    await page.getByRole("button", { name: "Request a new link", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
