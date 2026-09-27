import type { FastifyPluginAsync } from "fastify";
import { assertCanManageOrgReference } from "../../lib/authorization.ts";
import { inspectionCategoriesRepository } from "./repository.ts";
import { inspectionCategoriesService } from "./service.ts";
import type { CategoryOwner, CreateCategoryInput, UpdateCategoryInput } from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
  additionalProperties: false,
} as const;

const categoryParams = {
  type: "object",
  required: ["id", "categoryId"],
  properties: { id: { type: "string" }, categoryId: { type: "string" } },
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  properties: { includeArchived: { type: "boolean", default: false } },
  additionalProperties: false,
} as const;

const createBody = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    scope: { type: "string", enum: ["organization", "project"] },
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

/**
 * The list a project inspects against: BuildPanda's global service catalogue
 * plus its own workspace's additions. Anyone who can see inspections reads it;
 * a workspace admin adds to it; only BuildPanda changes the catalogue itself
 * (see admin-routes.ts).
 */
const inspectionCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = inspectionCategoriesService(inspectionCategoriesRepository(fastify.db));

  function ownerOf(project: { id: string; organization_id: string | null }): CategoryOwner {
    return { projectId: project.id, organizationId: project.organization_id };
  }

  fastify.get<{ Params: { id: string }; Querystring: { includeArchived?: boolean } }>(
    "/projects/:id/inspection-categories",
    {
      schema: {
        params: projectIdParams,
        querystring: listQuery,
        response: { 200: { type: "array", items: categoryResponse } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      return service.list(ownerOf(project), request.query.includeArchived ?? false);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateCategoryInput }>(
    "/projects/:id/inspection-categories",
    { schema: { params: projectIdParams, body: createBody, response: { 201: categoryResponse } } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      assertCanManageOrgReference(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      const category = await service.create(ownerOf(project), request.body, user.id);
      return reply.status(201).send(category);
    },
  );

  fastify.patch<{ Params: { id: string; categoryId: string }; Body: UpdateCategoryInput }>(
    "/projects/:id/inspection-categories/:categoryId",
    { schema: { params: categoryParams, body: updateBody, response: { 200: categoryResponse } } },
    async (request) => {
      const user = request.requireAuth();
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      assertCanManageOrgReference(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return service.update(ownerOf(project), request.params.categoryId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; categoryId: string } }>(
    "/projects/:id/inspection-categories/:categoryId",
    {
      schema: {
        params: categoryParams,
        response: {
          200: { type: "object", properties: { archived: { type: "boolean" } } },
        },
      },
    },
    async (request) => {
      const user = request.requireAuth();
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      assertCanManageOrgReference(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return service.remove(ownerOf(project), request.params.categoryId);
    },
  );
};

export default inspectionCategoryRoutes;
