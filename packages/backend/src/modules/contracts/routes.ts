import type { FastifyPluginAsync } from "fastify";
import { documentsRepository } from "../documents/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { contractsRepository } from "./repository.ts";
import { contractsService } from "./service.ts";
import {
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  type CreateContractInput,
  type UpdateContractInput,
} from "./types.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const contractParams = {
  type: "object",
  required: ["id", "contractId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    contractId: { type: "string", minLength: 1 },
  },
} as const;

const DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    trade: { type: ["string", "null"], maxLength: 120 },
    legalEntity: { type: ["string", "null"], maxLength: 200 },
    total: { type: "number", minimum: 0 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    trade: { type: ["string", "null"], maxLength: 120 },
    legalEntity: { type: ["string", "null"], maxLength: 200 },
    status: { type: "string", enum: CONTRACT_STATUSES },
    documentId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    signedAt: { type: ["string", "null"], pattern: DATE_PATTERN },
  },
} as const;

const contractSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    kind: { type: "string", enum: CONTRACT_KINDS },
    changeRequestId: { type: ["string", "null"] },
    title: { type: "string" },
    trade: { type: ["string", "null"] },
    legalEntity: { type: ["string", "null"] },
    total: { type: "number" },
    status: { type: "string", enum: CONTRACT_STATUSES },
    signedAt: { type: ["string", "null"] },
    documentId: { type: ["string", "null"] },
    documentName: { type: ["string", "null"] },
    phaseCount: { type: "integer" },
    createdAt: { type: "string" },
  },
} as const;

const contractRoutes: FastifyPluginAsync = async (fastify) => {
  const service = contractsService(contractsRepository(fastify.db), {
    finances: financesRepository(fastify.db),
    stages: stagesRepository(fastify.db),
    documents: documentsRepository(fastify.db),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/contracts",
    { schema: { params: projectIdParams, response: { 200: { type: "array", items: contractSchema } } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateContractInput }>(
    "/projects/:id/contracts",
    { schema: { params: projectIdParams, body: createBody, response: { 201: contractSchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const contract = await service.create(project.id, request.body);
      return reply.status(201).send(contract);
    },
  );

  fastify.patch<{ Params: { id: string; contractId: string }; Body: UpdateContractInput }>(
    "/projects/:id/contracts/:contractId",
    { schema: { params: contractParams, body: updateBody, response: { 200: contractSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return service.update(project.id, request.params.contractId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; contractId: string } }>(
    "/projects/:id/contracts/:contractId",
    { schema: { params: contractParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      await service.remove(project.id, request.params.contractId);
      return reply.status(204).send();
    },
  );
};

export default contractRoutes;
