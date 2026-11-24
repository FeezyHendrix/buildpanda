import assert from "node:assert/strict";
import { test } from "node:test";
import { canConnectTelegram, telegramChannel, telegramConnectUrl } from "./telegram-connection.ts";
import type { MessagingStatus } from "../api/messaging-agent.ts";
import type { ProjectAccess } from "./project-types.ts";

test("linking denies missing access and uses the exact project grant without role defaults", () => {
  assert.equal(canConnectTelegram(undefined), false);
  for (const role of ["owner", "admin", "project_manager", "guest"]) {
    assert.equal(canConnectTelegram({ relationship: role, permissions: {} } as unknown as ProjectAccess), false);
    assert.equal(canConnectTelegram({ relationship: role, permissions: { project: ["view"] } } as unknown as ProjectAccess), true);
  }
});

test("the server must allow Telegram in this exact user and project, including external project participants", () => {
  const status: MessagingStatus = { userId: "crew", enabled: true, projects: [{ id: "site", organizationId: "org" }],
    channels: [{ id: "telegram", accountId: "bot", enabled: true }], connections: [] };
  assert.equal(telegramChannel(status, "crew", "site")?.accountId, "bot");
  assert.equal(telegramChannel({ ...status, projects: [{ id: "site", organizationId: "external-org" }] }, "crew", "site")?.accountId, "bot");
  assert.equal(telegramChannel(undefined, "crew", "site"), undefined);
  assert.equal(telegramChannel(status, "other-user", "site"), undefined);
  assert.equal(telegramChannel(status, "crew", "other-site"), undefined);
  for (const denied of [{ ...status, enabled: false }, { ...status, projects: [] }, { ...status, channels: [{ ...status.channels[0]!, enabled: false }] }]) {
    assert.equal(telegramChannel(denied, "crew", "site"), undefined);
  }
});

test("only fresh Telegram links with the exact server-issued token can leave the app", () => {
  const code = "a".repeat(32), now = Date.now();
  const link = { code, expiresAt: new Date(now + 60_000).toISOString(), connectUrl: `https://t.me/buildpanda_bot?start=${code}` };
  assert.equal(telegramConnectUrl(link, now), link.connectUrl);
  for (const connectUrl of [null, "javascript:alert(1)", link.connectUrl.replace("https:", "http:"), link.connectUrl.replace("t.me", "t.me.attacker.test"),
    link.connectUrl.replace("t.me", "user:pass@t.me"), link.connectUrl.replace(code, "b".repeat(32)), `${link.connectUrl}&other=1`, `${link.connectUrl}#fragment`]) {
    assert.throws(() => telegramConnectUrl({ ...link, connectUrl }, now));
  }
  for (const expiresAt of [new Date(now).toISOString(), "invalid"]) assert.throws(() => telegramConnectUrl({ ...link, expiresAt }, now));
});
