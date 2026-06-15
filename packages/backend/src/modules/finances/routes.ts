import type { FastifyPluginAsync } from "fastify";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { financesRepository } from "./repository.ts";
import {
  financesService,
  type CreateMilestoneInput,
  type DepositInput,
  type RaiseDisputeInput,
  type UpdateMilestoneInput,
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

const milestoneBody = {
  type: "object",
  required: ["name", "phase", "amount"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    phase: { type: "string", minLength: 1, maxLength: 200 },
    amount: { type: "number", minimum: 0 },
    percentComplete: { type: "integer", minimum: 0, maximum: 100 },
    status: { type: "string", enum: ["Completed", "InProgress", "Pending"] },
    inspectorSignOff: { type: "string", enum: ["Verified", "Scheduled", "Pending"] },
  },
} as const;

const milestonePatchBody = {
  type: "object",
  additionalProperties: false,
  properties: milestoneBody.properties,
} as const;

const financeRoutes: FastifyPluginAsync = async (fastify) => {
  const service = financesService(financesRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/finances",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: DepositInput }>(
    "/projects/:id/finances/deposits",
    { schema: { params: projectIdParams, body: depositBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const finances = await service.deposit(project.id, request.body);
      return reply.status(201).send(finances);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMilestoneInput }>(
    "/projects/:id/finances/milestones",
    { schema: { params: projectIdParams, body: milestoneBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const milestone = await service.createMilestone(project.id, request.body);
      return reply.status(201).send(milestone);
    },
  );

  fastify.patch<{
    Params: { id: string; milestoneId: string };
    Body: UpdateMilestoneInput;
  }>(
    "/projects/:id/finances/milestones/:milestoneId",
    { schema: { params: milestoneParams, body: milestonePatchBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.updateMilestone(
        project.id,
        request.params.milestoneId,
        request.body,
      );
    },
  );

  fastify.delete<{ Params: { id: string; milestoneId: string } }>(
    "/projects/:id/finances/milestones/:milestoneId",
    { schema: { params: milestoneParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.deleteMilestone(project.id, request.params.milestoneId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; milestoneId: string } }>(
    "/projects/:id/finances/milestones/:milestoneId/release",
    { schema: { params: milestoneParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "approve");
      const user = request.requireAuth();
      const milestone = await service.releaseMilestone(
        project.id,
        request.params.milestoneId,
        user.id,
      );
      return reply.status(200).send(milestone);
    },
  );

  fastify.get<{ Params: { id: string; milestoneId: string } }>(
    "/projects/:id/finances/milestones/:milestoneId/disputes",
    { schema: { params: milestoneParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listDisputes(project.id, request.params.milestoneId);
    },
  );

  fastify.post<{
    Params: { id: string; milestoneId: string };
    Body: RaiseDisputeInput;
  }>(
    "/projects/:id/finances/milestones/:milestoneId/disputes",
    { schema: { params: milestoneParams, body: disputeBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "dispute");
      const user = request.requireAuth();
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
