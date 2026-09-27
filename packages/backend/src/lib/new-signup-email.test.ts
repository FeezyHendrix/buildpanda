import assert from "node:assert/strict";
import { test } from "node:test";
import { newSignupEmail } from "./email-templates.ts";

test("the notice names the person and their address so it can be acted on", () => {
  const { subject, html } = newSignupEmail({
    name: "Tunde Okafor",
    email: "tunde@okaforbuild.ng",
    companyName: "Okafor Build Ltd",
    country: "NG",
    invited: false,
  });
  assert.match(subject, /New BuildPanda sign-up: Tunde Okafor/);
  assert.match(html, /tunde@okaforbuild\.ng/);
  assert.match(html, /Okafor Build Ltd/);
  assert.match(html, /NG/);
});

test("a cold sign-up and an accepted invitation are told apart", () => {
  assert.match(newSignupEmail(base({ invited: false })).html, /Signed up directly/);
  assert.match(newSignupEmail(base({ invited: true })).html, /Accepted an invitation/);
});

test("company and country are optional, and their rows simply do not appear", () => {
  const { html } = newSignupEmail(base({ companyName: null, country: null }));
  assert.doesNotMatch(html, />Company</);
  assert.doesNotMatch(html, />Country</);
});

test("a name carrying markup cannot inject it into the email", () => {
  const { subject, html } = newSignupEmail(
    base({ name: '<img src=x onerror="alert(1)">', companyName: "</td><script>bad()</script>" }),
  );
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.match(html, /&lt;img src=x/);
  // The subject line is not HTML, so it carries the raw name rather than entities.
  assert.match(subject, /<img src=x/);
});

function base(over: Partial<Parameters<typeof newSignupEmail>[0]> = {}) {
  return {
    name: "Ada Chukwu",
    email: "ada@example.com",
    companyName: "Sentinel",
    country: "NG",
    invited: false,
    ...over,
  };
}
