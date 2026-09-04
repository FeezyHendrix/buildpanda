import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeHtmlFields, sanitizeRichText } from "./rich-text.ts";

test("drops markup that would execute in a reader's browser", () => {
  assert.equal(sanitizeRichText("<script>alert(1)</script>"), "");
  assert.equal(sanitizeRichText("<p>ok</p><script>steal()</script>"), "<p>ok</p>");
  // The payload that does not need a script tag.
  assert.ok(!sanitizeRichText('<img src=x onerror="steal()">').includes("onerror"));
  assert.ok(!sanitizeRichText('<p onclick="steal()">hi</p>').includes("onclick"));
  assert.ok(!sanitizeRichText("<iframe src='//evil'></iframe>").includes("iframe"));
});

test("strips javascript: and data: hrefs but keeps real links", () => {
  assert.ok(!sanitizeRichText('<a href="javascript:steal()">x</a>').includes("javascript:"));
  assert.ok(!sanitizeRichText('<a href="data:text/html;base64,x">x</a>').includes("data:"));
  const safe = sanitizeRichText('<a href="https://buildpanda.io">docs</a>');
  assert.ok(safe.includes('href="https://buildpanda.io"'));
  assert.ok(safe.includes('rel="noopener noreferrer"'), "a link out must not hand over the opener");
});

test("keeps the formatting the editors actually produce", () => {
  const rich = "<p><strong>Poured</strong> the <em>slab</em></p><ul><li>grid B</li></ul>";
  assert.equal(sanitizeRichText(rich), rich);
});

test("passes through null and undefined untouched", () => {
  assert.equal(sanitizeRichText(null), null);
  assert.equal(sanitizeRichText(undefined), undefined);
});

test("sanitises every *Html field in a body, nested, and leaves the rest alone", () => {
  const body = {
    bodyText: "<script>not html field</script>",
    bodyHtml: "<p>ok</p><script>x()</script>",
    nested: { descriptionHtml: '<img src=x onerror="x()">', title: "untouched" },
    items: [{ contentHtml: "<script>y()</script><em>keep</em>" }],
  };
  const out = sanitizeHtmlFields(body) as typeof body;

  assert.equal(out.bodyHtml, "<p>ok</p>");
  assert.ok(!out.nested.descriptionHtml.includes("onerror"));
  assert.equal(out.items[0]!.contentHtml, "<em>keep</em>");
  // Only *Html keys are rich text; a plain text column must survive verbatim.
  assert.equal(out.bodyText, "<script>not html field</script>");
  assert.equal(out.nested.title, "untouched");
});
