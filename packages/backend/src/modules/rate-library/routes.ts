import type { FastifyPluginAsync } from "fastify";
import { rateLibraryRepository } from "./repository.ts";
import { rateLibraryService } from "./service.ts";
import { BUILDUP_COMPONENTS } from "./types.ts";
import type {
  BuildupInput,
  CreateQuoteSourceInput,
  MatchRatesInput,
  UpsertRateCardInput,
  UpsertRateInput,
} from "./types.ts";

const cardParams = {
  type: "object",
  required: ["cardId"],
  additionalProperties: false,
  properties: { cardId: { type: "string", minLength: 1 } },
} as const;

const rateParams = {
  type: "object",
  required: ["cardId", "rateId"],
  additionalProperties: false,
  properties: { cardId: { type: "string", minLength: 1 }, rateId: { type: "string", minLength: 1 } },
} as const;

const quoteParams = {
  type: "object",
  required: ["quoteId"],
  additionalProperties: false,
  properties: { quoteId: { type: "string", minLength: 1 } },
} as const;

const cardBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    region: { type: ["string", "null"], maxLength: 120 },
    isDefault: { type: "boolean" },
  },
} as const;

const rateBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: ["string", "null"], maxLength: 200 },
    codePrefix: { type: ["string", "null"], maxLength: 20 },
    descriptionPattern: { type: ["string", "null"], maxLength: 400 },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    rate: { type: "number", minimum: 0 },
  },
} as const;

const buildupsBody = {
  type: "array",
  maxItems: 50,
  items: {
    type: "object",
    required: ["component", "description", "qty", "unit", "unitCost"],
    additionalProperties: false,
    properties: {
      component: { type: "string", enum: BUILDUP_COMPONENTS },
      description: { type: "string", minLength: 1, maxLength: 300 },
      qty: { type: "number", minimum: 0 },
      unit: { type: "string", minLength: 1, maxLength: 20 },
      unitCost: { type: "number", minimum: 0 },
      wastePct: { type: "number", minimum: 0, maximum: 100 },
    },
  },
} as const;

const quoteBody = {
  type: "object",
  required: ["supplierName"],
  additionalProperties: false,
  properties: {
    rateId: { type: ["string", "null"], maxLength: 100 },
    supplierName: { type: "string", minLength: 1, maxLength: 200 },
    reference: { type: ["string", "null"], maxLength: 120 },
    validUntil: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    fileId: { type: ["string", "null"], maxLength: 100 },
    amount: { type: ["number", "null"], minimum: 0 },
    unit: { type: ["string", "null"], maxLength: 20 },
    notes: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

const matchBody = {
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        required: ["description", "unit"],
        additionalProperties: false,
        properties: {
          code: { type: ["string", "null"], maxLength: 40 },
          description: { type: "string", maxLength: 500 },
          unit: { type: "string", maxLength: 20 },
        },
      },
    },
  },
} as const;

// Mounted under the pre-existing /precon/rate-cards prefix so the take-off
// pricing engine and any saved links keep working; the org's default currency
// is what a new card prices in.
const rateLibraryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = rateLibraryService(rateLibraryRepository(fastify.db));

  async function orgCurrency(orgId: string): Promise<string> {
    const org = await fastify.db("organization").where({ id: orgId }).select("default_currency").first();
    return (org?.default_currency as string | undefined) ?? "NGN";
  }

  fastify.get("/precon/rate-cards", async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("rateCards", "view");
    return service.listCards(orgId);
  });

  fastify.post<{ Body: UpsertRateCardInput }>(
    "/precon/rate-cards",
    { schema: { body: { ...cardBody, required: ["name"] } } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      const card = await service.createCard(orgId, request.body, await orgCurrency(orgId));
      return reply.status(201).send(card);
    },
  );

  fastify.patch<{ Params: { cardId: string }; Body: Partial<UpsertRateCardInput> }>(
    "/precon/rate-cards/:cardId",
    { schema: { params: cardParams, body: { ...cardBody, minProperties: 1 } } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.updateCard(orgId, request.params.cardId, request.body);
    },
  );

  fastify.delete<{ Params: { cardId: string } }>(
    "/precon/rate-cards/:cardId",
    { schema: { params: cardParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.removeCard(orgId, request.params.cardId);
    },
  );

  fastify.post<{ Params: { cardId: string }; Body: UpsertRateInput }>(
    "/precon/rate-cards/:cardId/rates",
    { schema: { params: cardParams, body: { ...rateBody, required: ["unit", "rate"] } } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      const rate = await service.addRate(orgId, request.params.cardId, request.body);
      return reply.status(201).send(rate);
    },
  );

  fastify.patch<{ Params: { cardId: string; rateId: string }; Body: Partial<UpsertRateInput> }>(
    "/precon/rate-cards/:cardId/rates/:rateId",
    { schema: { params: rateParams, body: { ...rateBody, minProperties: 1 } } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.updateRate(orgId, request.params.cardId, request.params.rateId, request.body);
    },
  );

  fastify.delete<{ Params: { cardId: string; rateId: string } }>(
    "/precon/rate-cards/:cardId/rates/:rateId",
    { schema: { params: rateParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.removeRate(orgId, request.params.cardId, request.params.rateId);
    },
  );

  fastify.put<{ Params: { cardId: string; rateId: string }; Body: BuildupInput[] }>(
    "/precon/rate-cards/:cardId/rates/:rateId/buildups",
    { schema: { params: rateParams, body: buildupsBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.setBuildups(orgId, request.params.cardId, request.params.rateId, request.body);
    },
  );

  fastify.post<{ Body: MatchRatesInput }>(
    "/precon/rate-cards/match",
    { schema: { body: matchBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "view");
      return service.matchRates(orgId, request.body);
    },
  );

  fastify.get("/precon/quote-sources", async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("rateCards", "view");
    return service.listQuotes(orgId);
  });

  fastify.post<{ Body: CreateQuoteSourceInput }>(
    "/precon/quote-sources",
    { schema: { body: quoteBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      const quote = await service.addQuote(orgId, user.id, request.body);
      return reply.status(201).send(quote);
    },
  );

  fastify.delete<{ Params: { quoteId: string } }>(
    "/precon/quote-sources/:quoteId",
    { schema: { params: quoteParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.removeQuote(orgId, request.params.quoteId);
    },
  );
};

export default rateLibraryRoutes;
