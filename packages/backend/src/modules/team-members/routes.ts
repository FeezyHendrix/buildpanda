import type { FastifyPluginAsync } from "fastify";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { teamMembersRepository } from "./repository.ts";
import {
  teamMembersService,
  type CreateTeamMemberInput,
  type EditTeamMemberInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const memberParams = {
  type: "object",
  required: ["id", "memberId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    memberId: { type: "string", minLength: 1 },
  },
} as const;

const statusSchema = { type: "string", enum: ["Active", "Inactive"] } as const;

const createMemberBody = {
  type: "object",
  required: ["name", "role"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    role: { type: "string", minLength: 1, maxLength: 120 },
    company: { type: "string", maxLength: 200 },
    email: { type: "string", maxLength: 320 },
    phone: { type: "string", maxLength: 60 },
    responsibilities: { type: "string", maxLength: 2000 },
    status: statusSchema,
  },
} as const;

const editMemberBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    role: { type: "string", minLength: 1, maxLength: 120 },
    company: { type: "string", maxLength: 200 },
    email: { type: "string", maxLength: 320 },
    phone: { type: "string", maxLength: 60 },
    responsibilities: { type: "string", maxLength: 2000 },
    status: statusSchema,
  },
} as const;

const teamMemberRoutes: FastifyPluginAsync = async (fastify) => {
  const service = teamMembersService(teamMembersRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/team-members",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "teamMembers", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateTeamMemberInput }>(
    "/projects/:id/team-members",
    { schema: { params: projectIdParams, body: createMemberBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "teamMembers", "manage");
      const user = request.requireAuth();
      const member = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(member);
    },
  );

  fastify.put<{
    Params: { id: string; memberId: string };
    Body: EditTeamMemberInput;
  }>(
    "/projects/:id/team-members/:memberId",
    { schema: { params: memberParams, body: editMemberBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "teamMembers", "manage");
      return service.edit(project.id, request.params.memberId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; memberId: string } }>(
    "/projects/:id/team-members/:memberId",
    { schema: { params: memberParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "teamMembers", "manage");
      await service.remove(project.id, request.params.memberId);
      return reply.status(204).send();
    },
  );
};

export default teamMemberRoutes;
