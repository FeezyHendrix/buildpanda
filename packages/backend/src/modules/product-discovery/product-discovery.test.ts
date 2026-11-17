import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { adminProductDiscoveryRoutes } from "./routes.ts";
import { ASK_SIGNUPS_FROM, productDiscoveryService, summarizeDiscovery } from "./service.ts";
import type { ProductDiscoveryRepository } from "./repository.ts";
import type { DiscoveryAskState, DiscoveryResponseRow } from "./types.ts";

const dueFor = async (state: DiscoveryAskState | undefined) =>
  (await productDiscoveryService({ askState: async () => state } as unknown as ProductDiscoveryRepository).status("u")).due;

test("only new signups who have not answered are asked", async () => {
  const after = new Date(ASK_SIGNUPS_FROM.getTime() + 1000);
  const before = new Date(ASK_SIGNUPS_FROM.getTime() - 1000);
  assert.equal(await dueFor({ createdAt: after, answered: false }), true);
  assert.equal(await dueFor({ createdAt: after, answered: true }), false);
  assert.equal(await dueFor({ createdAt: before, answered: false }), false);
  assert.equal(await dueFor(undefined), false);
});

test("summary counts each option once per response", () => {
  const row = (over: Partial<DiscoveryResponseRow>): DiscoveryResponseRow => ({
    user_id: "u1",
    name: "Ada",
    email: "ada@example.com",
    signed_up_at: new Date(),
    use_cases: [],
    referral_sources: [],
    current_tools: [],
    role: null,
    team_size: null,
    active_projects: null,
    completed_at: null,
    demo_booked_at: null,
    created_at: new Date(),
    ...over,
  });
  const summary = summarizeDiscovery([
    row({ use_cases: ["Proposals and tenders"], role: "Project manager", completed_at: new Date(), demo_booked_at: new Date() }),
    row({ user_id: "u2", use_cases: ["Proposals and tenders", "Just exploring"] }),
  ]);
  const count = (key: keyof typeof summary.counts, label: string) =>
    summary.counts[key].find((c) => c.label === label)?.value;
  assert.deepEqual([summary.total, summary.completed, summary.demosBooked], [2, 1, 1]);
  assert.equal(count("useCases", "Proposals and tenders"), 2);
  assert.equal(count("useCases", "Just exploring"), 1);
  assert.equal(count("role", "Project manager"), 1);
  assert.equal(summary.responses[1]!.completed, false);
});

test("the Watchtower summary is refused to anyone who is not an admin", async () => {
  const app = Fastify({ logger: false });
  app.decorate("db", (() => {
    throw new Error("gate let the request through to the database");
  }) as never);
  app.decorateRequest("requireAdmin", () => {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  });
  await app.register(adminProductDiscoveryRoutes);
  const res = await app.inject({ method: "GET", url: "/admin/product-discovery" });
  assert.equal(res.statusCode, 403);
  await app.close();
});
