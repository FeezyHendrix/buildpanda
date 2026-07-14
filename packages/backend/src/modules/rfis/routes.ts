import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { assertCanActAsClient, canProjectPermission } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { config } from "../../config/index.ts";
import { sendEmail } from "../../lib/mail.ts";
import { rfiBallInCourtEmail, rfiDistributionEmail } from "../../lib/email-templates.ts";
import { projectsRepository } from "../projects/repository.ts";
import { changeRequestsRepository } from "../change-requests/repository.ts";
import { changeRequestsService } from "../change-requests/service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { rfisRepository } from "./repository.ts";
import {
  rfisService,
  type CreateRfiInput,
  type DistributionInput,
  type RespondInput,
  type UpdateRfiInput,
} from "./service.ts";
import {
  RFI_DISTRIBUTION_ROLES,
  RFI_PRIORITIES,
  RFI_STATUSES,
  type Rfi,
  type RfiStatus,
} from "./types.ts";

const TRANSITION_TARGETS = ["Closed", "Void", "Open"] as const;

const EXTERNAL_REPLY_TTL_DAYS = 14;

const rfiParams = {
  type: "object",
  required: ["id", "rfiId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    rfiId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: RFI_STATUSES },
    ballInCourt: { type: "string", enum: ["mine"] },
  },
} as const;

const createBody = {
  type: "object",
  required: ["subject", "question"],
  additionalProperties: false,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 8000 },
    priority: { type: "string", enum: RFI_PRIORITIES },
    ballInCourtId: { type: ["string", "null"], maxLength: 100 },
    ballInCourtName: { type: ["string", "null"], maxLength: 200 },
    ballInCourtEmail: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    assigneeRole: { type: ["string", "null"], maxLength: 40 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    costImpact: { type: "boolean" },
    scheduleImpact: { type: "boolean" },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 8000 },
    priority: { type: "string", enum: RFI_PRIORITIES },
    ballInCourtId: { type: ["string", "null"], maxLength: 100 },
    ballInCourtName: { type: ["string", "null"], maxLength: 200 },
    ballInCourtEmail: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    assigneeRole: { type: ["string", "null"], maxLength: 40 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    costImpact: { type: "boolean" },
    scheduleImpact: { type: "boolean" },
  },
} as const;

const respondBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 8000 },
    official: { type: "boolean" },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
    attachments: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["fileId", "url", "name"],
        additionalProperties: false,
        properties: {
          fileId: { type: "string", maxLength: 100 },
          url: { type: "string", maxLength: 1000 },
          name: { type: "string", maxLength: 300 },
        },
      },
    },
    references: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["type", "id", "label"],
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["action_item", "activity"] },
          id: { type: "string", maxLength: 100 },
          label: { type: "string", maxLength: 300 },
        },
      },
    },
  },
} as const;

const transitionBody = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: { status: { type: "string", enum: TRANSITION_TARGETS } },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 4000 } },
} as const;

const distributionBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    userId: { type: ["string", "null"], maxLength: 100 },
    email: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    name: { type: ["string", "null"], maxLength: 200 },
    role: { type: "string", enum: RFI_DISTRIBUTION_ROLES },
  },
} as const;

const rfiRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = rfisService(rfisRepository(fastify.db), {
    changeRequests: changeRequestsService(changeRequestsRepository(fastify.db)),
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  async function loadProject(id: string) {
    const project = await projects.findById(id);
    if (!project) throw new NotFoundError("Project");
    return project;
  }

  function isCompanyCaller(
    request: FastifyRequest,
    project: { owner_id: string | null; organization_id: string | null },
  ): boolean {
    const user = request.requireAuth();
    if (project.owner_id === user.id) return true;
    return Boolean(project.organization_id && request.orgRoles.has(project.organization_id));
  }

  async function sendBallInCourtEmail(rfi: Rfi, projectName: string, actorEmail: string): Promise<void> {
    if (!rfi.ballInCourtEmail) return;
    if (rfi.ballInCourtEmail.toLowerCase() === actorEmail.toLowerCase()) return;

    const url = `${config.mail.appUrl.replace(/\/+$/, "")}/project/${rfi.projectId}/rfis`;
    const { subject, html } = rfiBallInCourtEmail({
      recipientName: rfi.ballInCourtName ?? rfi.ballInCourtEmail,
      projectName,
      rfiNumber: rfi.number,
      rfiSubject: rfi.subject,
      question: rfi.question,
      url,
    });
    await sendEmail({
      to: rfi.ballInCourtEmail,
      toName: rfi.ballInCourtName ?? undefined,
      subject,
      html,
    }).catch(() => undefined);
  }

  fastify.get<{ Params: { id: string }; Querystring: { status?: RfiStatus; ballInCourt?: "mine" } }>(
    "/projects/:id/rfis",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "view");
      const user = request.requireAuth();
      return service.list(project.id, {
        status: request.query.status,
        ballInCourtId: request.query.ballInCourt === "mine" ? user.id : undefined,
        sharedOnly: !isCompanyCaller(request, project),
      });
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateRfiInput }>(
    "/projects/:id/rfis",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanActAsClient(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      const isClient = request.projectRoles.get(project.id) === "client";
      const created = await service.create(
        project.id,
        request.body,
        { id: user.id, name: user.name },
        isClient ? "shared" : "internal",
      );
      await sendBallInCourtEmail(created, project.name, user.email);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; rfiId: string } }>(
    "/projects/:id/rfis/:rfiId",
    { schema: { params: rfiParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "view");
      return service.get(project.id, request.params.rfiId, !isCompanyCaller(request, project));
    },
  );

  fastify.patch<{ Params: { id: string; rfiId: string }; Body: UpdateRfiInput }>(
    "/projects/:id/rfis/:rfiId",
    { schema: { params: rfiParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "manage");
      const user = request.requireAuth();
      const reassignmentRequested =
        request.body.ballInCourtId !== undefined || request.body.ballInCourtEmail !== undefined;
      const current = reassignmentRequested
        ? await service.get(project.id, request.params.rfiId)
        : null;
      const updated = await service.update(project.id, request.params.rfiId, request.body, {
        id: user.id,
        name: user.name,
      });
      if (reassignmentRequested && updated.ballInCourtEmail !== current?.ballInCourtEmail) {
        await sendBallInCourtEmail(updated, project.name, user.email);
      }
      return updated;
    },
  );

  fastify.post<{ Params: { id: string; rfiId: string }; Body: RespondInput }>(
    "/projects/:id/rfis/:rfiId/respond",
    { schema: { params: rfiParams, body: respondBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "respond");
      const user = request.requireAuth();
      const canRespondOfficially = canProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        {
          userId: user.id,
          orgRoles: request.orgRoles,
          projectRoles: request.projectRoles,
          orgPermissions: request.orgPermissions,
        },
        "rfis",
        "manage",
      );
      return service.respond(
        project.id,
        request.params.rfiId,
        request.body,
        { id: user.id, name: user.name },
        canRespondOfficially,
      );
    },
  );

  fastify.post<{ Params: { id: string; rfiId: string }; Body: { status: (typeof TRANSITION_TARGETS)[number] } }>(
    "/projects/:id/rfis/:rfiId/transition",
    { schema: { params: rfiParams, body: transitionBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "manage");
      const user = request.requireAuth();
      return service.transition(project.id, request.params.rfiId, request.body.status, {
        id: user.id,
        name: user.name,
      });
    },
  );

  fastify.post<{ Params: { id: string; rfiId: string }; Body: { body: string } }>(
    "/projects/:id/rfis/:rfiId/comments",
    { schema: { params: rfiParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.rfiId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );

  fastify.get<{ Params: { id: string; rfiId: string } }>(
    "/projects/:id/rfis/:rfiId/distribution",
    { schema: { params: rfiParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "view");
      return service.listDistribution(project.id, request.params.rfiId);
    },
  );

  fastify.post<{ Params: { id: string; rfiId: string }; Body: DistributionInput }>(
    "/projects/:id/rfis/:rfiId/distribution",
    { schema: { params: rfiParams, body: distributionBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "manage");
      const user = request.requireAuth();
      const rfi = await service.get(project.id, request.params.rfiId);
      const { member, replyToken } = await service.addDistribution(
        project.id,
        request.params.rfiId,
        request.body,
        { id: user.id, name: user.name },
        EXTERNAL_REPLY_TTL_DAYS,
      );

      if (replyToken && member.email) {
        const replyUrl = `${config.mail.appUrl}/rfi-reply/${replyToken}`;
        const { subject, html } = rfiDistributionEmail({
          recipientName: member.name ?? member.email,
          projectName: project.name,
          rfiNumber: rfi.number,
          rfiSubject: rfi.subject,
          question: rfi.question,
          replyUrl,
        });
        await sendEmail({ to: member.email, toName: member.name ?? undefined, subject, html }).catch(
          () => undefined,
        );
      }

      return reply.status(201).send(member);
    },
  );

  fastify.post<{ Params: { id: string; rfiId: string } }>(
    "/projects/:id/rfis/:rfiId/convert-to-change",
    { schema: { params: rfiParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "manage");
      const user = request.requireAuth();
      const updated = await service.convertToChange(project.id, request.params.rfiId, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(updated);
    },
  );
};

export default rfiRoutes;
