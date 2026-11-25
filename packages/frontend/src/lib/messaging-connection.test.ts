import assert from "node:assert/strict";
import { test } from "node:test";
import { MESSAGING_CHANNEL, MESSAGING_CHANNELS, canConnectMessaging, channelConnectUrl, connectionChannel } from "./messaging-connection.ts";
import type { MessagingStatus } from "../api/messaging-agent.ts";
import type { ProjectAccess } from "./project-types.ts";

const [telegram, whatsapp] = MESSAGING_CHANNELS;

test("linking denies missing access and uses the exact project grant without role defaults", () => {
  assert.equal(canConnectMessaging(undefined), false);
  for (const role of ["owner", "admin", "project_manager", "guest"]) {
    assert.equal(canConnectMessaging({ relationship: role, permissions: {} } as unknown as ProjectAccess), false);
    assert.equal(canConnectMessaging({ relationship: role, permissions: { project: ["view"] } } as unknown as ProjectAccess), true);
  }
});

test("the server must allow the channel in this exact user and project, including external project participants", () => {
  const status: MessagingStatus = { userId: "crew", enabled: true, projects: [{ id: "site", organizationId: "org" }],
    channels: [{ id: MESSAGING_CHANNEL.telegram, accountId: "bot", enabled: true }, { id: MESSAGING_CHANNEL.whatsapp, accountId: "phone", enabled: false }], connections: [] };
  assert.equal(connectionChannel(status, "crew", "site", MESSAGING_CHANNEL.telegram)?.accountId, "bot");
  assert.equal(connectionChannel({ ...status, projects: [{ id: "site", organizationId: "external-org" }] }, "crew", "site", MESSAGING_CHANNEL.telegram)?.accountId, "bot");
  assert.equal(connectionChannel(undefined, "crew", "site", MESSAGING_CHANNEL.telegram), undefined);
  assert.equal(connectionChannel(status, "other-user", "site", MESSAGING_CHANNEL.telegram), undefined);
  assert.equal(connectionChannel(status, "crew", "other-site", MESSAGING_CHANNEL.telegram), undefined);
  for (const denied of [{ ...status, enabled: false }, { ...status, projects: [] }, { ...status, channels: [{ ...status.channels[0]!, enabled: false }] }]) {
    assert.equal(connectionChannel(denied, "crew", "site", MESSAGING_CHANNEL.telegram), undefined);
  }
  // A disabled WhatsApp account stays hidden; enabling it shows only WhatsApp's own account.
  assert.equal(connectionChannel(status, "crew", "site", MESSAGING_CHANNEL.whatsapp), undefined);
  const enabled = { ...status, channels: status.channels.map((channel) => ({ ...channel, enabled: true })) };
  assert.equal(connectionChannel(enabled, "crew", "site", MESSAGING_CHANNEL.whatsapp)?.accountId, "phone");
});

test("only fresh Telegram links with the exact server-issued token can leave the app", () => {
  const code = "a".repeat(32), now = Date.now();
  const link = { code, expiresAt: new Date(now + 60_000).toISOString(), connectUrl: `https://t.me/buildpanda_bot?start=${code}` };
  assert.equal(channelConnectUrl(link, telegram, now), link.connectUrl);
  for (const connectUrl of [null, "javascript:alert(1)", link.connectUrl.replace("https:", "http:"), link.connectUrl.replace("t.me", "t.me.attacker.test"),
    link.connectUrl.replace("t.me", "user:pass@t.me"), link.connectUrl.replace(code, "b".repeat(32)), `${link.connectUrl}&other=1`, `${link.connectUrl}#fragment`]) {
    assert.throws(() => channelConnectUrl({ ...link, connectUrl }, telegram, now));
  }
  for (const expiresAt of [new Date(now).toISOString(), "invalid"]) assert.throws(() => channelConnectUrl({ ...link, expiresAt }, telegram, now));
  // A WhatsApp link is never accepted for the Telegram card.
  assert.throws(() => channelConnectUrl({ ...link, connectUrl: `https://wa.me/2348000000000?text=LINK%20${code}` }, telegram, now));
});

test("only fresh WhatsApp links that prefill the exact server-issued LINK code can leave the app", () => {
  const code = "a".repeat(32), now = Date.now();
  const link = { code, expiresAt: new Date(now + 60_000).toISOString(), connectUrl: `https://wa.me/2348000000000?text=LINK%20${code}` };
  assert.equal(channelConnectUrl(link, whatsapp, now), link.connectUrl);
  for (const connectUrl of [null, "javascript:alert(1)", link.connectUrl.replace("https:", "http:"), link.connectUrl.replace("wa.me", "wa.me.attacker.test"),
    link.connectUrl.replace("wa.me", "user:pass@wa.me"), link.connectUrl.replace(code, "b".repeat(32)), link.connectUrl.replace("2348000000000", "buildpanda"),
    `${link.connectUrl}&other=1`, `${link.connectUrl}#fragment`, `https://t.me/buildpanda_bot?start=${code}`]) {
    assert.throws(() => channelConnectUrl({ ...link, connectUrl }, whatsapp, now));
  }
  for (const expiresAt of [new Date(now).toISOString(), "invalid"]) assert.throws(() => channelConnectUrl({ ...link, expiresAt }, whatsapp, now));
});
