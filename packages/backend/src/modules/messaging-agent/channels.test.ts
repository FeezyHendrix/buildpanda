import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError, ServiceUnavailableError } from "../../lib/errors.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import type { MessagingChannelAdapter } from "./channel-types.ts";

const adapter: MessagingChannelAdapter = {
  channel: "first-messenger", channelAccountId: "account", label: "First messenger", maxTextLength: 4096,
  connectUrl: () => null, canReply: () => true,
  sendText: async () => { throw new Error("No sends in registry tests"); },
  downloadAudio: async () => { throw new Error("No downloads in registry tests"); },
};

test("the registry distinguishes channels and accounts without granting a missing adapter", () => {
  const second = { ...adapter, channel: "second-messenger" };
  const anotherAccount = { ...adapter, channelAccountId: "another-account" };
  const registry = messagingAdapterRegistry([adapter, second, anotherAccount]);
  assert.equal(registry.list().length, 3);
  assert.equal(registry.get(second.channel, second.channelAccountId), second);
  assert.equal(registry.get(adapter.channel, anotherAccount.channelAccountId), anotherAccount);
  assert.equal(registry.find("not-configured", adapter.channelAccountId), undefined);
  assert.throws(() => registry.get(adapter.channel, "not-configured"), ServiceUnavailableError);
});

test("invalid adapters and duplicate account registrations fail closed", () => {
  for (const bad of [{ ...adapter, channel: "" }, { ...adapter, channel: "UPPER" }, { ...adapter, channelAccountId: "" },
    { ...adapter, maxTextLength: 0 }, { ...adapter, maxTextLength: 1.5 }]) {
    assert.throws(() => messagingAdapterRegistry([bad]), BadRequestError);
  }
  assert.throws(() => messagingAdapterRegistry([adapter, { ...adapter }]), BadRequestError);
});
