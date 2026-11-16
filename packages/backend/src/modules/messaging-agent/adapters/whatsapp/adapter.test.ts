import assert from "node:assert/strict";
import { test } from "node:test";
import { withinWhatsAppServiceWindow, whatsappChannelAdapter } from "./adapter.ts";

test("WhatsApp owns its reply window and number-based link URL", () => {
  const now = new Date();
  assert.equal(withinWhatsAppServiceWindow(null, now), false);
  assert.equal(withinWhatsAppServiceWindow(new Date(now.getTime() - 24 * 60 * 60_000), now), false);
  assert.equal(withinWhatsAppServiceWindow(new Date(now.getTime() + 6 * 60_000), now), false);
  assert.equal(withinWhatsAppServiceWindow(new Date(now.getTime() - 1000), now), true);
  const adapter = whatsappChannelAdapter({ enabled: true, phoneNumberId: "155555500000", businessNumber: "+15555550000", apiVersion: "v25.0", accessToken: "test", appSecret: "test", verifyToken: "test" }, {
    sendText: async () => { throw new Error("No external sends in this test"); },
    downloadAudio: async () => { throw new Error("No external downloads in this test"); },
  });
  assert.equal(adapter.channel, "whatsapp"); assert.equal(adapter.channelAccountId, "155555500000");
  assert.equal(adapter.maxTextLength, 4096);
  assert.match(adapter.connectUrl("opaque code")!, /^https:\/\/wa\.me\/15555550000\?text=LINK%20opaque%20code$/);
  assert.equal(adapter.canReply(new Date(now.getTime() - 25 * 60 * 60_000), now), false);
});
