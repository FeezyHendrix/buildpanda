import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { inspectionsRepository } from "./repository.ts";
import { inspectionsService, type RequestInspectionInput, type EditInspectionInput } from "./service.ts";

const inspectionParams = {
  type: "object",
  required: ["id", "inspectionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    inspectionId: { type: "string", minLength: 1 },
  },
} as const;

const inspectorBody = {
  type: "object",
  additionalProperties: false,
  required: ["name", "role"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 200 },
    role: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const inspectionCategoryEnum = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
] as const;

const requestInspectionBody = {
  type: "object",
  required: ["title", "category", "description", "scheduledAt"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    category: {
      type: "string",
      enum: [...inspectionCategoryEnum],
    },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
    inspector: inspectorBody,
  },
} as const;

const editInspectionBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    category: { type: "string", enum: [...inspectionCategoryEnum] },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
    status: {
      type: "string",
      enum: ["Action Required", "Completed", "Scheduled"],
    },
    riskLevel: { type: "string", enum: ["Low", "Medium", "High"] },
    inspector: inspectorBody,
  },
} as const;

const inspectionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = inspectionsService(inspectionsRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/inspections",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: RequestInspectionInput }>(
    "/projects/:id/inspections",
    { schema: { params: projectIdParams, body: requestInspectionBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const inspection = await service.request(project.id, request.body);
      return reply.status(201).send(inspection);
    },
  );

  fastify.put<{
    Params: { id: string; inspectionId: string };
    Body: EditInspectionInput;
  }>(
    "/projects/:id/inspections/:inspectionId",
    { schema: { params: inspectionParams, body: editInspectionBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.edit(project.id, request.params.inspectionId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; inspectionId: string } }>(
    "/projects/:id/inspections/:inspectionId",
    { schema: { params: inspectionParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.inspectionId);
      return reply.status(204).send();
    },
  );
};

export default inspectionRoutes;
