import type { FastifyPluginAsync } from "fastify";
import { assertCanModify } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { financesRepository } from "./repository.ts";
import {
  financesService,
  type DepositInput,
  type RaiseDisputeInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const milestoneParams = {
  type: "object",
  required: ["id", "milestoneId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    milestoneId: { type: "string", minLength: 1 },
  },
} as const;

const depositBody = {
  type: "object",
  required: ["amount"],
  additionalProperties: false,
  properties: {
    amount: { type: "number", exclusiveMinimum: 0 },
    description: { type: "string", minLength: 1, maxLength: 200 },
    entryDate: { type: "string", minLength: 1, maxLength: 30 },
  },
} as const;

const disputeBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 2000 },
  },
} as const;

const financeRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = financesService(financesRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/finances",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.getByProject(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: DepositInput }>(
    "/projects/:id/finances/deposits",
    { schema: { params: projectIdParams, body: depositBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const finances = await service.deposit(project.id, request.body);
      return reply.status(201).send(finances);
    },
  );

  fastify.post<{ Params: { id: string; milestoneId: string } }>(
    "/projects/:id/finances/milestones/:milestoneId/release",
    { schema: { params: milestoneParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const milestone = await service.releaseMilestone(
        project.id,
        request.params.milestoneId,
      );
      return reply.status(200).send(milestone);
    },
  );

  fastify.get<{ Params: { id: string; milestoneId: string } }>(
    "/projects/:id/finances/milestones/:milestoneId/disputes",
    { schema: { params: milestoneParams } },
    async (request) => {
      request.requireAuth();
      return service.listDisputes(request.params.id, request.params.milestoneId);
    },
  );

  fastify.post<{
    Params: { id: string; milestoneId: string };
    Body: RaiseDisputeInput;
  }>(
    "/projects/:id/finances/milestones/:milestoneId/disputes",
    { schema: { params: milestoneParams, body: disputeBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const dispute = await service.raiseDispute(
        project.id,
        request.params.milestoneId,
        request.body,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send(dispute);
    },
  );
};

export default financeRoutes;
