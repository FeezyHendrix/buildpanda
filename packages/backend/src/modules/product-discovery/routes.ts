import type { FastifyPluginAsync } from "fastify";
import { productDiscoveryRepository } from "./repository.ts";
import { productDiscoveryService } from "./service.ts";
import { DISCOVERY_QUESTIONS, type DiscoveryInput } from "./types.ts";

const many = (options: readonly string[]) =>
  ({ type: "array", uniqueItems: true, maxItems: options.length, items: { type: "string", enum: options } }) as const;
const one = (options: readonly string[]) => ({ type: "string", enum: options }) as const;
const labels = { type: "array", items: { type: "string" } } as const;
const tally = {
  type: "array",
  items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } } },
} as const;

const statusSchema = {
  response: {
    200: {
      type: "object",
      properties: { due: { type: "boolean" }, questions: { type: "object", additionalProperties: labels } },
    },
  },
} as const;

const saveSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      useCases: many(DISCOVERY_QUESTIONS.useCases),
      referralSources: many(DISCOVERY_QUESTIONS.referralSources),
      currentTools: many(DISCOVERY_QUESTIONS.currentTools),
      role: one(DISCOVERY_QUESTIONS.role),
      teamSize: one(DISCOVERY_QUESTIONS.teamSize),
      activeProjects: one(DISCOVERY_QUESTIONS.activeProjects),
      completed: { type: "boolean" },
      demoBooked: { type: "boolean" },
    },
  },
  response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
} as const;

const summarySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        asOf: { type: "string" },
        asked: { type: "number" },
        total: { type: "number" },
        completed: { type: "number" },
        demosBooked: { type: "number" },
        counts: { type: "object", additionalProperties: tally },
        responses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              signedUpAt: { type: "string" },
              answeredAt: { type: "string" },
              completed: { type: "boolean" },
              demoBooked: { type: "boolean" },
              role: { type: ["string", "null"] },
              teamSize: { type: ["string", "null"] },
              activeProjects: { type: ["string", "null"] },
              useCases: labels,
              referralSources: labels,
              currentTools: labels,
            },
          },
        },
      },
    },
  },
} as const;

// A user only ever reads and writes their own answers, so sign-in is the whole access rule.
const productDiscoveryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = productDiscoveryService(productDiscoveryRepository(fastify.db));

  fastify.get("/product-discovery", { schema: statusSchema }, async (request) =>
    service.status(request.requireAuth().id),
  );

  fastify.put<{ Body: DiscoveryInput }>("/product-discovery", { schema: saveSchema }, async (request) => {
    await service.save(request.requireAuth().id, request.body);
    return { ok: true };
  });
};

// Registered inside adminRoutes, so its admin gate and audit hooks apply here.
export const adminProductDiscoveryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = productDiscoveryService(productDiscoveryRepository(fastify.db));
  fastify.get("/admin/product-discovery", { schema: summarySchema }, async (request) => {
    request.requireAdmin();
    return service.adminSummary();
  });
};

export default productDiscoveryRoutes;
