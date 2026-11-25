import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyRequest } from "fastify";
import { clientIp } from "./client-geo.ts";

const request = (headers: Record<string, string>) => ({ headers, ip: "10.0.0.1" }) as unknown as FastifyRequest;

test("clientIp prefers the edge-set X-Real-IP over a client-supplied X-Forwarded-For", () => {
  assert.equal(clientIp(request({ "x-real-ip": "102.88.168.67", "x-forwarded-for": "1.2.3.4, 102.88.168.67" })), "102.88.168.67");
  assert.equal(clientIp(request({ "x-forwarded-for": "102.88.168.67, 10.1.1.1" })), "102.88.168.67");
  assert.equal(clientIp(request({})), "10.0.0.1");
});

test("Better Auth rate-limits sign-in per caller behind a multi-hop proxy, not in one shared bucket", async () => {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const build = (ipAddress?: { ipAddressHeaders: string[] }) => betterAuth({
    baseURL: "https://api.example.test", secret: "x".repeat(32), database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true }, logger: { disabled: true },
    rateLimit: { enabled: true, storage: "memory", window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 2 } } },
    advanced: ipAddress ? { ipAddress } : {},
  });
  const signIn = (auth: ReturnType<typeof build>, ip: string) => auth.handler(new Request("https://api.example.test/api/auth/sign-in/email", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://api.example.test", "x-real-ip": ip, "x-forwarded-for": `${ip}, 100.64.0.2` },
    body: JSON.stringify({ email: "nobody@example.test", password: "wrong-password" }),
  })).then((response) => response.status);

  const fixed = build({ ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] });
  for (let i = 0; i < 2; i++) assert.notEqual(await signIn(fixed, "102.88.168.67"), 429);
  assert.equal(await signIn(fixed, "102.88.168.67"), 429);
  assert.notEqual(await signIn(fixed, "41.58.1.1"), 429, "another caller keeps their own allowance");

  const shared = build();
  for (let i = 0; i < 2; i++) await signIn(shared, "102.88.168.67");
  assert.equal(await signIn(shared, "41.58.1.1"), 429, "default headers put every caller in one bucket");
});
