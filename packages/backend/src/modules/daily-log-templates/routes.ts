import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { assertCanManageOrgReference } from "../../lib/authorization.ts";
import { dailyLogTemplatesRepository } from "./repository.ts";
import { dailyLogTemplatesService } from "./service.ts";
import {
  MAX_SELECT_OPTIONS,
  MAX_TEMPLATE_FIELDS,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_SCOPES,
  type CreateTemplateInput,
  type TemplateOwner,
  type UpdateTemplateInput,
} from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
  additionalProperties: false,
} as const;

const templateParams = {
  type: "object",
  required: ["id", "templateId"],
  properties: { id: { type: "string", minLength: 1 }, templateId: { type: "string", minLength: 1 } },
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  properties: { includeArchived: { type: "boolean", default: false } },
  additionalProperties: false,
} as const;

const fieldInput = {
  type: "object",
  required: ["type", "label"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    type: { type: "string", enum: TEMPLATE_FIELD_TYPES },
    label: { type: "string", minLength: 1, maxLength: 200 },
    helpText: { type: ["string", "null"], maxLength: 500 },
    required: { type: "boolean" },
    options: {
      type: "array",
      maxItems: MAX_SELECT_OPTIONS,
      items: { type: "string", minLength: 1, maxLength: 120 },
    },
    unit: { type: ["string", "null"], maxLength: 30 },
  },
} as const;

const fieldsInput = { type: "array", maxItems: MAX_TEMPLATE_FIELDS, items: fieldInput } as const;

const createBody = {
  type: "object",
  required: ["name", "fields"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: ["string", "null"], maxLength: 1000 },
    scope: { type: "string", enum: TEMPLATE_SCOPES },
    fields: fieldsInput,
    isDefault: { type: "boolean" },
  },
} as const;

const updateBody = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: ["string", "null"], maxLength: 1000 },
    fields: fieldsInput,
    isDefault: { type: "boolean" },
    active: { type: "boolean" },
  },
} as const;

export const templateFieldResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: TEMPLATE_FIELD_TYPES },
    label: { type: "string" },
    helpText: { type: ["string", "null"] },
    required: { type: "boolean" },
    options: { type: "array", items: { type: "string" } },
    unit: { type: ["string", "null"] },
  },
} as const;

const templateResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    scope: { type: "string", enum: TEMPLATE_SCOPES },
    fields: { type: "array", items: templateFieldResponse },
    isDefault: { type: "boolean" },
    active: { type: "boolean" },
    usageCount: { type: "integer" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

/**
 * The site diary forms a project fills: its organisation's library plus any
 * project-only form. Anyone who can read the diary reads the forms; a
 * workspace admin (or the owner of a personal project) maintains them.
 */
const dailyLogTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  const service = dailyLogTemplatesService(dailyLogTemplatesRepository(fastify.db));

  function ownerOf(project: { id: string; organization_id: string | null }): TemplateOwner {
    return { projectId: project.id, organizationId: project.organization_id };
  }

  async function requireManager(request: FastifyRequest, projectId: string) {
    const user = request.requireAuth();
    const project = await request.requireProjectPermission(projectId, "dailyLog", "view");
    assertCanManageOrgReference(
      { ownerId: project.owner_id, organizationId: project.organization_id },
      { userId: user.id, orgRoles: request.orgRoles },
    );
    return { user, project };
  }

  fastify.get<{ Params: { id: string }; Querystring: { includeArchived?: boolean } }>(
    "/projects/:id/daily-log-templates",
    {
      schema: {
        params: projectIdParams,
        querystring: listQuery,
        response: { 200: { type: "array", items: templateResponse } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.list(ownerOf(project), request.query.includeArchived ?? false);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateTemplateInput }>(
    "/projects/:id/daily-log-templates",
    { schema: { params: projectIdParams, body: createBody, response: { 201: templateResponse } } },
    async (request, reply) => {
      const { user, project } = await requireManager(request, request.params.id);
      const template = await service.create(ownerOf(project), request.body, user.id);
      return reply.status(201).send(template);
    },
  );

  fastify.patch<{ Params: { id: string; templateId: string }; Body: UpdateTemplateInput }>(
    "/projects/:id/daily-log-templates/:templateId",
    { schema: { params: templateParams, body: updateBody, response: { 200: templateResponse } } },
    async (request) => {
      const { project } = await requireManager(request, request.params.id);
      return service.update(ownerOf(project), request.params.templateId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; templateId: string } }>(
    "/projects/:id/daily-log-templates/:templateId",
    {
      schema: {
        params: templateParams,
        response: { 200: { type: "object", properties: { archived: { type: "boolean" } } } },
      },
    },
    async (request) => {
      const { project } = await requireManager(request, request.params.id);
      return service.remove(ownerOf(project), request.params.templateId);
    },
  );
};

export default dailyLogTemplateRoutes;
