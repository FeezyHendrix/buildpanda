import type { FastifyPluginAsync } from "fastify";
import { suppliersRepository } from "./repository.ts";
import { suppliersService } from "./service.ts";
import type { CreateSupplierInput, SupplierOwner, UpdateSupplierInput } from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const supplierParams = {
  type: "object",
  required: ["id", "supplierId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    supplierId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    includeInactive: { type: "boolean" },
  },
} as const;

const supplierFields = {
  contactName: { type: ["string", "null"], maxLength: 200 },
  email: { type: ["string", "null"], maxLength: 320 },
  phone: { type: ["string", "null"], maxLength: 50 },
  address: { type: ["string", "null"], maxLength: 500 },
  notes: { type: ["string", "null"], maxLength: 4000 },
  trade: { type: ["string", "null"], maxLength: 120 },
  approved: { type: "boolean" },
  leadTimeDays: { type: ["integer", "null"], minimum: 0, maximum: 365 },
  paymentTerms: { type: ["string", "null"], maxLength: 200 },
} as const;

const supplierBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    ...supplierFields,
    name: { type: "string", minLength: 1, maxLength: 200 },
    scope: { type: "string", enum: ["project", "organization"] },
    force: { type: "boolean" },
  },
} as const;

const supplierPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...supplierFields,
    name: { type: "string", minLength: 1, maxLength: 200 },
    active: { type: "boolean" },
  },
} as const;

const supplierResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: ["string", "null"] },
    organizationId: { type: ["string", "null"] },
    scope: { type: "string", enum: ["project", "organization"] },
    name: { type: "string" },
    contactName: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    trade: { type: ["string", "null"] },
    approved: { type: "boolean" },
    leadTimeDays: { type: ["integer", "null"] },
    paymentTerms: { type: ["string", "null"] },
    active: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const suppliersRoutes: FastifyPluginAsync = async (fastify) => {
  const service = suppliersService(suppliersRepository(fastify.db));

  function ownerOf(project: { id: string; organization_id: string | null }): SupplierOwner {
    return { projectId: project.id, organizationId: project.organization_id };
  }

  fastify.get<{ Params: { id: string }; Querystring: { includeInactive?: boolean } }>(
    "/projects/:id/suppliers",
    {
      schema: {
        params: projectIdParams,
        querystring: listQuery,
        response: { 200: { type: "array", items: supplierResponse } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.list(ownerOf(project), request.query.includeInactive ?? false);
    },
  );

  fastify.get<{ Params: { id: string; supplierId: string } }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams, response: { 200: supplierResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.get(ownerOf(project), request.params.supplierId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateSupplierInput }>(
    "/projects/:id/suppliers",
    { schema: { params: projectIdParams, body: supplierBody, response: { 201: supplierResponse } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      const user = request.requireAuth();
      const supplier = await service.create(ownerOf(project), request.body, user.id);
      return reply.status(201).send(supplier);
    },
  );

  fastify.put<{ Params: { id: string; supplierId: string }; Body: UpdateSupplierInput }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams, body: supplierPatchBody, response: { 200: supplierResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      return service.update(ownerOf(project), request.params.supplierId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; supplierId: string } }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      await service.remove(ownerOf(project), request.params.supplierId);
      return reply.status(204).send();
    },
  );
};

export default suppliersRoutes;
