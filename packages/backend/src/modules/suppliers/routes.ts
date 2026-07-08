import type { FastifyPluginAsync } from "fastify";
import { suppliersRepository } from "./repository.ts";
import { suppliersService } from "./service.ts";
import type { CreateSupplierInput, UpdateSupplierInput } from "./types.ts";

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

const supplierBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    contactName: { type: ["string", "null"], maxLength: 200 },
    email: { type: ["string", "null"], maxLength: 320 },
    phone: { type: ["string", "null"], maxLength: 50 },
    address: { type: ["string", "null"], maxLength: 500 },
    notes: { type: ["string", "null"], maxLength: 4000 },
  },
} as const;

const supplierPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: { ...supplierBody.properties, active: { type: "boolean" } },
} as const;

const suppliersRoutes: FastifyPluginAsync = async (fastify) => {
  const service = suppliersService(suppliersRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { includeInactive?: boolean } }>(
    "/projects/:id/suppliers",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.list(project.id, request.query.includeInactive ?? false);
    },
  );

  fastify.get<{ Params: { id: string; supplierId: string } }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.get(project.id, request.params.supplierId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateSupplierInput }>(
    "/projects/:id/suppliers",
    { schema: { params: projectIdParams, body: supplierBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      const user = request.requireAuth();
      const supplier = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(supplier);
    },
  );

  fastify.put<{ Params: { id: string; supplierId: string }; Body: UpdateSupplierInput }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams, body: supplierPatchBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      return service.update(project.id, request.params.supplierId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; supplierId: string } }>(
    "/projects/:id/suppliers/:supplierId",
    { schema: { params: supplierParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      await service.remove(project.id, request.params.supplierId);
      return reply.status(204).send();
    },
  );
};

export default suppliersRoutes;
