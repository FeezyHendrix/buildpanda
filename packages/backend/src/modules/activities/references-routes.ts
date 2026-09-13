import type { FastifyPluginAsync } from "fastify";
import { activityReferencesRepository } from "./references-repository.ts";
import { activityReferencesService } from "./references-service.ts";

const activityParams = {
  type: "object",
  required: ["id", "activityId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    activityId: { type: "string", minLength: 1 },
  },
} as const;

const referencesResponse = {
  200: {
    type: "object",
    properties: {
      activityId: { type: "string" },
      blockedByApprovedLookAhead: { type: "boolean" },
      openDelayCount: { type: "integer" },
      lookAheads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
          },
        },
      },
      delays: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reasonCode: { type: "string" },
            startedAt: { type: "string" },
            resolved: { type: "boolean" },
          },
        },
      },
    },
  },
} as const;

/**
 * What would break if this activity went away. Registered separately from
 * `activities/routes.ts` so the delete-confirm dialog can ask the question
 * without the programme module owning the answer.
 */
const activityReferencesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = activityReferencesService(activityReferencesRepository(fastify.db));

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId/references",
    { schema: { params: activityParams, response: referencesResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "activities", "view");
      return service.get(project.id, request.params.activityId);
    },
  );
};

export default activityReferencesRoutes;
