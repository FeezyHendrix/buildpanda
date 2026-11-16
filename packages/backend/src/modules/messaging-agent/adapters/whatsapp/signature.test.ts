import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyWhatsAppSignature } from "./signature.ts";

test("webhook signatures bind exact raw bytes and require the app secret", () => {
  const body = Buffer.from('{"text":"site update"}');
  const signature = "sha256=" + createHmac("sha256", "test-secret").update(body).digest("hex");
  assert.equal(verifyWhatsAppSignature(body, signature, "test-secret"), true);
  assert.equal(verifyWhatsAppSignature(Buffer.from('{ "text":"site update"}'), signature, "test-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, signature, "another-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, signature, ""), false);
});

test("missing, malformed, truncated and non-sha256 signatures fail closed", () => {
  for (const signature of [undefined, "", "sha1=" + "0".repeat(40), "sha256=abc", "sha256=" + "z".repeat(64)]) {
    assert.equal(verifyWhatsAppSignature(Buffer.from("{}"), signature, "test-secret"), false);
  }
});
