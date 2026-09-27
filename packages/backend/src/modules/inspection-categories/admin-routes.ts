import type { FastifyPluginAsync } from "fastify";
import { inspectionCategoriesRepository } from "./repository.ts";
import { inspectionCategoriesService } from "./service.ts";
import type { CreateCategoryInput, GlobalCatalogue, UpdateCategoryInput } from "./types.ts";

/**
 * BuildPanda's own inspection catalogue — the services the platform offers,
 * visible on every project. A workspace may add its own categories on top, but
 * this list belongs to the platform, so only a platform admin edits it.
 *
 * Registered outside the admin module, so the admin gate is applied here
 * explicitly rather than inherited from that plugin's encapsulated hook.
 */

const CATALOGUE: GlobalCatalogue = { global: true };

const categoryParams = {
  type: "object",
  required: ["categoryId"],
  properties: { categoryId: { type: "string", minLength: 1 } },
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  properties: { includeArchived: { type: "boolean", default: true } },
  additionalProperties: false,
} as const;

const createBody = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0 },
  },
  additionalProperties: false,
} as const;

const updateBody = {
  type: "object",
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0 },
    active: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const categoryResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    scope: { type: "string", enum: ["global", "organization", "project"] },
    sortOrder: { type: "integer" },
    active: { type: "boolean" },
    usageCount: { type: "integer" },
  },
} as const;

const adminInspectionCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = inspectionCategoriesService(inspectionCategoriesRepository(fastify.db));

  fastify.get<{ Querystring: { includeArchived?: boolean } }>(
    "/admin/inspection-categories",
    {
      schema: {
        querystring: listQuery,
        response: { 200: { type: "array", items: categoryResponse } },
      },
    },
    async (request) => {
      request.requireAdmin();
      return service.list(CATALOGUE, request.query.includeArchived ?? true);
    },
  );

  fastify.post<{ Body: CreateCategoryInput }>(
    "/admin/inspection-categories",
    { schema: { body: createBody, response: { 201: categoryResponse } } },
    async (request, reply) => {
      const admin = request.requireAdmin();
      const category = await service.create(CATALOGUE, request.body, admin.id);
      return reply.status(201).send(category);
    },
  );

  fastify.patch<{ Params: { categoryId: string }; Body: UpdateCategoryInput }>(
    "/admin/inspection-categories/:categoryId",
    { schema: { params: categoryParams, body: updateBody, response: { 200: categoryResponse } } },
    async (request) => {
      request.requireAdmin();
      return service.update(CATALOGUE, request.params.categoryId, request.body);
    },
  );

  fastify.delete<{ Params: { categoryId: string } }>(
    "/admin/inspection-categories/:categoryId",
    {
      schema: {
        params: categoryParams,
        response: { 200: { type: "object", properties: { archived: { type: "boolean" } } } },
      },
    },
    async (request) => {
      request.requireAdmin();
      return service.remove(CATALOGUE, request.params.categoryId);
    },
  );
};

export default adminInspectionCategoryRoutes;
