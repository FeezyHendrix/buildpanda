import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { contractSideOf } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { inspectionsRepository } from "./repository.ts";
import { inspectionsService } from "./service.ts";
import {
  INSPECTION_CATEGORIES,
  INSPECTION_OUTCOMES,
  REQUESTER_SIDES,
  SERVICE_STATUSES,
  type EditInspectionInput,
  type InspectionActor,
  type RecordOutcomeInput,
  type RequestInspectionInput,
} from "./types.ts";

const inspectionParams = {
  type: "object",
  required: ["id", "inspectionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    inspectionId: { type: "string", minLength: 1 },
  },
} as const;

const inspectionCategoryEnum = INSPECTION_CATEGORIES;

const holdPointFields = {
  activityId: { type: ["string", "null"], maxLength: 100 },
  location: { type: ["string", "null"], maxLength: 200 },
  holdPoint: { type: "boolean" },
} as const;

// The fee is RECORDED, never charged — BuildPanda moves no money.
const serviceFields = {
  contractorName: { type: ["string", "null"], maxLength: 200 },
  feeAmount: { type: ["number", "null"], minimum: 0 },
  feeCurrency: { type: ["string", "null"], maxLength: 10 },
} as const;

const inspectionResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    inspector: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        role: { type: "string" },
        initialsTone: { type: "string" },
        avatarUrl: { type: "string" },
      },
    },
    inspectorUserId: { type: ["string", "null"] },
    title: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    descriptionHtml: { type: ["string", "null"] },
    status: { type: "string" },
    serviceStatus: { type: "string", enum: [...SERVICE_STATUSES] },
    riskLevel: { type: "string" },
    scheduledAt: { type: "string" },
    activityId: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    holdPoint: { type: "boolean" },
    outcome: { type: ["string", "null"], enum: [...INSPECTION_OUTCOMES, null] },
    findings: { type: ["string", "null"] },
    reinspectionDate: { type: ["string", "null"] },
    inspectedAt: { type: ["string", "null"] },
    inspectedByName: { type: ["string", "null"] },
    requestedById: { type: ["string", "null"] },
    requestedBySide: { type: "string", enum: [...REQUESTER_SIDES] },
    contractorName: { type: ["string", "null"] },
    reportIssuedAt: { type: ["string", "null"] },
    feeAmount: { type: ["number", "null"] },
    feeCurrency: { type: ["string", "null"] },
    media: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          url: { type: "string" },
        },
      },
    },
    reportUrl: { type: "string" },
  },
} as const;

const recordOutcomeBody = {
  type: "object",
  required: ["outcome"],
  additionalProperties: false,
  properties: {
    outcome: { type: "string", enum: [...INSPECTION_OUTCOMES] },
    findings: { type: ["string", "null"], maxLength: 4000 },
    reinspectionDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    media: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["type", "url"],
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["photo", "video"] },
          url: { type: "string", maxLength: 1000 },
        },
      },
    },
  },
} as const;

const requestInspectionBody = {
  type: "object",
  required: ["title", "category", "description", "scheduledAt"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    category: { type: "string", enum: [...inspectionCategoryEnum] },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
    ...holdPointFields,
    ...serviceFields,
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
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
    status: { type: "string", enum: ["Action Required", "Completed", "Scheduled"] },
    riskLevel: { type: "string", enum: ["Low", "Medium", "High"] },
    ...holdPointFields,
    ...serviceFields,
  },
} as const;

/** Identity for the independence rule. Platform admin is BuildPanda staff. */
function actorOf(request: FastifyRequest): InspectionActor {
  const user = request.requireAuth();
  return { id: user.id, name: user.name ?? null, isPlatformAdmin: user.role === "admin" };
}

const inspectionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = inspectionsService(inspectionsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/inspections",
    {
      schema: {
        params: projectIdParams,
        response: { 200: { type: "array", items: inspectionResponse } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      return service.listByProject(project.id);
    },
  );

  // Ordering the service. The client asks; a contractor-side caller may order
  // one too, but which side asked is recorded, never claimed.
  fastify.post<{ Params: { id: string }; Body: RequestInspectionInput }>(
    "/projects/:id/inspections",
    {
      schema: {
        params: projectIdParams,
        body: requestInspectionBody,
        response: { 201: inspectionResponse },
      },
    },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "request");
      const actor = actorOf(request);
      const side = contractSideOf(request.projectRoles.get(project.id));
      const inspection = await service.request(project.id, request.body, actor, side);
      return reply.status(201).send(inspection);
    },
  );

  fastify.put<{
    Params: { id: string; inspectionId: string };
    Body: EditInspectionInput;
  }>(
    "/projects/:id/inspections/:inspectionId",
    {
      schema: {
        params: inspectionParams,
        body: editInspectionBody,
        response: { 200: inspectionResponse },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "manage");
      return service.edit(
        project.id,
        request.params.inspectionId,
        request.body,
        actorOf(request),
      );
    },
  );

  // Attending and reporting are the inspector's acts. `inspections:manage` gets
  // you to the handler; the service decides whether you are the inspector.
  fastify.post<{ Params: { id: string; inspectionId: string } }>(
    "/projects/:id/inspections/:inspectionId/attended",
    { schema: { params: inspectionParams, response: { 200: inspectionResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      return service.markAttended(project.id, request.params.inspectionId, actorOf(request));
    },
  );

  fastify.post<{ Params: { id: string; inspectionId: string }; Body: RecordOutcomeInput }>(
    "/projects/:id/inspections/:inspectionId/outcome",
    {
      schema: {
        params: inspectionParams,
        body: recordOutcomeBody,
        response: { 200: inspectionResponse },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      return service.recordOutcome(
        project.id,
        request.params.inspectionId,
        request.body,
        actorOf(request),
      );
    },
  );

  fastify.post<{ Params: { id: string; inspectionId: string } }>(
    "/projects/:id/inspections/:inspectionId/cancel",
    { schema: { params: inspectionParams, response: { 200: inspectionResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "view");
      return service.cancel(project.id, request.params.inspectionId, actorOf(request));
    },
  );

  fastify.delete<{ Params: { id: string; inspectionId: string } }>(
    "/projects/:id/inspections/:inspectionId",
    { schema: { params: inspectionParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "inspections", "manage");
      await service.remove(project.id, request.params.inspectionId, actorOf(request));
      return reply.status(204).send();
    },
  );
};

export default inspectionRoutes;
