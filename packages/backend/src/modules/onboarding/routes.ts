import type { FastifyPluginAsync } from "fastify";
import { onboardingRepository } from "./repository.ts";
import { onboardingService } from "./service.ts";
import { COMPANY_SIZES, USAGE_OPTIONS } from "./types.ts";

const completeBody = {
  type: "object",
  required: ["companyName", "country", "companySize", "firstName", "lastName", "usage"],
  additionalProperties: false,
  properties: {
    companyName: { type: "string", minLength: 1, maxLength: 120 },
    country: { type: "string", minLength: 2, maxLength: 2 },
    state: { type: ["string", "null"], maxLength: 120 },
    companySize: { type: "string", enum: COMPANY_SIZES },
    firstName: { type: "string", minLength: 1, maxLength: 100 },
    lastName: { type: "string", minLength: 1, maxLength: 100 },
    phoneCountryCode: { type: "string", minLength: 2, maxLength: 2 },
    phone: { type: "string", maxLength: 50 },
    usage: {
      type: "array",
      minItems: 1,
      items: { type: "string", enum: USAGE_OPTIONS },
      uniqueItems: true,
    },
  },
} as const;

const statusResponse = {
  200: {
    type: "object",
    properties: {
      completed: { type: "boolean" },
      completedAt: { type: ["string", "null"] },
      companyName: { type: ["string", "null"] },
      country: { type: ["string", "null"] },
      state: { type: ["string", "null"] },
      companySize: { type: ["string", "null"] },
      usage: { type: ["array", "null"], items: { type: "string" } },
    },
  },
} as const;

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  const service = onboardingService(onboardingRepository(fastify.db));

  fastify.get(
    "/v2/onboarding/status",
    { schema: { response: statusResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgScope();
      return service.status(orgId);
    },
  );

  fastify.post(
    "/v2/onboarding",
    { schema: { body: completeBody, response: statusResponse } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgScope();
      return service.complete(orgId, user.id, request.body as Parameters<typeof service.complete>[2]);
    },
  );
};

export default onboardingRoutes;
