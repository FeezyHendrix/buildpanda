import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { test as base } from "../fixtures/test";
import { env } from "../config/env";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(HERE, "../.auth");

interface ProvisionedIdentity {
  email: string;
  organizationId: string;
}

/**
 * RISK MAP — Workspace (organization) invitation flow.
 * - Upstream trigger: an owner invites a teammate by email; the teammate must
 *   be able to discover the invite (even without the email), accept it, and
 *   land in the inviter's workspace with it active.
 * - Expected guardrail: pending invites surface on the invitee's dashboard;
 *   accepting switches the active organization immediately.
 * - Failure liability: an accepted-but-not-active membership looks like the
 *   invite silently failed — the exact bug this spec pins down.
 */
base.describe("Workspace invitations @invitations", () => {
  base.skip(({ browserName }) => browserName !== "chromium", "chromium only");

  base("invited member discovers, accepts, and lands in the workspace", async ({ page, browser }) => {
    const users = JSON.parse(readFileSync(resolve(AUTH_DIR, "users.json"), "utf8")) as Record<
      string,
      ProvisionedIdentity
    >;
    const invitee = users["member"]!;

    // Owner sends the invitation (API call with the owner page's cookies).
    // better-auth's CSRF check requires a browser-like Origin header.
    const inviteRes = await page.request.post(`${env.apiUrl}/api/auth/organization/invite-member`, {
      headers: { Origin: env.baseUrl },
      data: { email: invitee.email, role: "admin" },
    });
    expect(inviteRes.ok()).toBeTruthy();

    // The invitee opens their dashboard in their own session.
    const inviteeContext = await browser.newContext({
      storageState: resolve(AUTH_DIR, "member.json"),
      baseURL: env.baseUrl,
    });
    try {
      const inviteePage = await inviteeContext.newPage();

      // Capture the invitee's active org before accepting.
      const before = await inviteePage.request
        .get(`${env.apiUrl}/api/auth/organization/get-full-organization`, { headers: { Origin: env.baseUrl } })
        .then((r) => r.json() as Promise<{ id?: string } | null>);

      await inviteePage.goto("/dashboard");

      // The pending invite is discoverable on the dashboard without the email.
      await expect(inviteePage.getByText(/invited to join/i).first()).toBeVisible();
      await inviteePage.getByRole("link", { name: /view invitation/i }).first().click();

      // Accept from the invitation page.
      await inviteePage.getByRole("button", { name: "Accept invitation" }).click();
      await expect(inviteePage).toHaveURL(/\/dashboard/);

      // The inviter's workspace is now the ACTIVE organization.
      await expect
        .poll(async () => {
          const active = await inviteePage.request
            .get(`${env.apiUrl}/api/auth/organization/get-full-organization`, { headers: { Origin: env.baseUrl } })
            .then((r) => r.json() as Promise<{ id?: string } | null>);
          return active?.id ?? null;
        })
        .toBe(users["owner"]!.organizationId);

      expect(before?.id).not.toBe(users["owner"]!.organizationId);
    } finally {
      await inviteeContext.close();
    }
  });
});
