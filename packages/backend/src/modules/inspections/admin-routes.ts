import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { paginationProperties } from "../../lib/schemas.ts";
import { inspectionsRepository } from "./repository.ts";
import { inspectionsService } from "./service.ts";
import {
  REQUESTER_SIDES,
  SERVICE_STATUSES,
  type AssignInspectorInput,
  type InspectionActor,
  type ServiceStatus,
} from "./types.ts";

/**
 * BuildPanda's own view of the inspection service: every request across every
 * project, and the one act only the platform performs — putting an inspector on
 * a job. Registered outside the admin module, so the admin gate is applied here
 * explicitly rather than inherited from that plugin's encapsulated hook.
 */

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    serviceStatus: { type: "string", enum: [...SERVICE_STATUSES] },
    search: { type: "string", maxLength: 200 },
    unassigned: { type: "boolean" },
    ...paginationProperties,
  },
} as const;

const inspectionIdParams = {
  type: "object",
  required: ["inspectionId"],
  additionalProperties: false,
  properties: { inspectionId: { type: "string", minLength: 1 } },
} as const;

const assignBody = {
  type: "object",
  required: ["inspectorUserId"],
  additionalProperties: false,
  properties: {
    inspectorUserId: { type: "string", minLength: 1, maxLength: 100 },
    role: { type: "string", minLength: 1, maxLength: 100 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const summaryResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    projectName: { type: ["string", "null"] },
    organizationId: { type: ["string", "null"] },
    organizationName: { type: ["string", "null"] },
    title: { type: "string" },
    category: { type: "string" },
    contractorName: { type: ["string", "null"] },
    serviceStatus: { type: "string", enum: [...SERVICE_STATUSES] },
    status: { type: "string" },
    outcome: { type: ["string", "null"] },
    scheduledAt: { type: "string" },
    reportIssuedAt: { type: ["string", "null"] },
    requestedById: { type: ["string", "null"] },
    requestedByName: { type: ["string", "null"] },
    requestedBySide: { type: "string", enum: [...REQUESTER_SIDES] },
    inspectorUserId: { type: ["string", "null"] },
    inspectorName: { type: ["string", "null"] },
    feeAmount: { type: ["number", "null"] },
    feeCurrency: { type: ["string", "null"] },
    createdAt: { type: "string" },
  },
} as const;

interface AdminListQuery {
  serviceStatus?: ServiceStatus;
  search?: string;
  unassigned?: boolean;
  limit?: number;
  offset?: number;
}

function adminActor(request: FastifyRequest): InspectionActor {
  const user = request.requireAdmin();
  return { id: user.id, name: user.name ?? null, isPlatformAdmin: true };
}

const adminInspectionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = inspectionsService(inspectionsRepository(fastify.db));

  fastify.get<{ Querystring: AdminListQuery }>(
    "/admin/inspections",
    {
      schema: {
        querystring: listQuery,
        response: {
          200: {
            type: "object",
            properties: {
              rows: { type: "array", items: summaryResponse },
              total: { type: "integer" },
            },
          },
        },
      },
    },
    async (request) => {
      request.requireAdmin();
      const { serviceStatus, search, unassigned, limit, offset } = request.query;
      return service.listRequests({
        ...(serviceStatus ? { serviceStatus } : {}),
        ...(search?.trim() ? { search: search.trim() } : {}),
        ...(unassigned ? { unassigned: true } : {}),
        limit: limit ?? 25,
        offset: offset ?? 0,
      });
    },
  );

  fastify.post<{ Params: { inspectionId: string }; Body: AssignInspectorInput }>(
    "/admin/inspections/:inspectionId/inspector",
    {
      schema: {
        params: inspectionIdParams,
        body: assignBody,
        response: { 200: summaryResponse },
      },
    },
    async (request) =>
      service.assignInspector(request.params.inspectionId, request.body, adminActor(request)),
  );
};

export default adminInspectionRoutes;
