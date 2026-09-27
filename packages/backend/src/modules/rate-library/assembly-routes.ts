import type { FastifyPluginAsync } from "fastify";
import { assemblyService } from "./assembly-service.ts";
import { rateLibraryRepository } from "./repository.ts";
import type { UpsertAssemblyInput } from "./types.ts";

const assemblyParams = {
  type: "object",
  required: ["assemblyId"],
  additionalProperties: false,
  properties: { assemblyId: { type: "string", minLength: 1 } },
} as const;

const itemSchema = {
  type: "object",
  required: ["description", "unit", "factor"],
  additionalProperties: false,
  properties: {
    description: { type: "string", minLength: 1, maxLength: 300 },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    factor: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
    elementGroup: { type: ["string", "null"], maxLength: 120 },
    rateId: { type: ["string", "null"], maxLength: 100 },
    code: { type: ["string", "null"], maxLength: 40 },
  },
} as const;

const assemblyBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    elementGroup: { type: "string", minLength: 1, maxLength: 120 },
    items: { type: "array", minItems: 1, maxItems: 50, items: itemSchema },
  },
} as const;

const itemResponse = {
  type: "object",
  properties: {
    description: { type: "string" },
    unit: { type: "string" },
    factor: { type: "number" },
    elementGroup: { type: "string" },
    rateId: { type: ["string", "null"] },
    code: { type: ["string", "null"] },
  },
} as const;

const assemblyResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    unit: { type: "string" },
    elementGroup: { type: "string" },
    items: { type: "array", items: itemResponse },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

// Assemblies live in the rate library: reading them is part of measuring
// (takeoffs view), changing them is curating the library (rateCards manage).
export const assemblyRoutes: FastifyPluginAsync = async (fastify) => {
  const service = assemblyService(rateLibraryRepository(fastify.db));

  fastify.get("/precon/assemblies", { schema: { response: { 200: { type: "array", items: assemblyResponse } } } }, async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("takeoffs", "view");
    return service.list(orgId);
  });

  fastify.post<{ Body: UpsertAssemblyInput }>(
    "/precon/assemblies",
    { schema: { body: { ...assemblyBody, required: ["name", "unit", "elementGroup", "items"] }, response: { 201: assemblyResponse } } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      const assembly = await service.create(orgId, user.id, request.body);
      return reply.status(201).send(assembly);
    },
  );

  fastify.patch<{ Params: { assemblyId: string }; Body: Partial<UpsertAssemblyInput> }>(
    "/precon/assemblies/:assemblyId",
    { schema: { params: assemblyParams, body: { ...assemblyBody, minProperties: 1 }, response: { 200: assemblyResponse } } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.update(orgId, request.params.assemblyId, request.body);
    },
  );

  fastify.delete<{ Params: { assemblyId: string } }>(
    "/precon/assemblies/:assemblyId",
    { schema: { params: assemblyParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("rateCards", "manage");
      return service.remove(orgId, request.params.assemblyId);
    },
  );
};
