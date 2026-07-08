import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { risksRepository } from "./repository.ts";
import { risksService, type CreateRiskInput, type EditRiskInput } from "./service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

const riskParams = {
  type: "object",
  required: ["id", "riskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    riskId: { type: "string", minLength: 1 },
  },
} as const;

const severitySchema = { type: "string", enum: ["Low", "Medium", "High"] } as const;

const createRiskBody = {
  type: "object",
  required: ["title", "description", "severity"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    severity: severitySchema,
  },
} as const;

const editRiskBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    severity: severitySchema,
  },
} as const;

const riskRoutes: FastifyPluginAsync = async (fastify) => {
  const service = risksService(risksRepository(fastify.db), {
    db: fastify.db,
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/risk-factors",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateRiskInput }>(
    "/projects/:id/risk-factors",
    { schema: { params: projectIdParams, body: createRiskBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      const risk = await service.create(project.id, request.body);
      return reply.status(201).send(risk);
    },
  );

  fastify.put<{
    Params: { id: string; riskId: string };
    Body: EditRiskInput;
  }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams, body: editRiskBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      return service.edit(project.id, request.params.riskId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; riskId: string } }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      await service.remove(project.id, request.params.riskId);
      return reply.status(204).send();
    },
  );
};

export default riskRoutes;
