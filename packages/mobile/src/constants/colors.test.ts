import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { palette } from "./colors";

const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js") as {
  theme: { extend: { colors: Record<string, string | Record<string, string>> } };
};
const colors = config.theme.extend.colors;

function token(name: string, shade?: string): string {
  const entry = colors[name];
  if (typeof entry === "string") return entry;
  assert.ok(entry && shade, `${name} is not in tailwind.config.js`);
  return entry[shade as string];
}

test("every palette constant is a tailwind.config.js token", () => {
  assert.equal(palette.primary500, token("primary", "500"));
  assert.equal(palette.surface, token("surface"));
  assert.equal(palette.surfaceAlt, token("surface-alt"));
  assert.equal(palette.canvas, token("canvas"));
  assert.equal(palette.hairline, token("hairline"));
  assert.equal(palette.success500, token("success", "500"));
  assert.equal(palette.success600, token("success", "600"));
  assert.equal(palette.success700, token("success", "700"));
  assert.equal(palette.error500, token("error", "500"));
  assert.equal(palette.error600, token("error", "600"));
  assert.equal(palette.warning600, token("warning", "600"));
  assert.equal(palette.amber700, token("amber", "700"));
  assert.equal(palette.grey50, token("grey", "50"));
  assert.equal(palette.grey100, token("grey", "100"));
  assert.equal(palette.grey200, token("grey", "200"));
  assert.equal(palette.grey300, token("grey", "300"));
  assert.equal(palette.grey400, token("grey", "400"));
  assert.equal(palette.grey600, token("grey", "600"));
  assert.equal(palette.black500, token("black", "500"));
});
