import type { FastifyPluginAsync } from "fastify";
import { budgetRepository } from "./repository.ts";
import {
  budgetService,
  type CreateCategoryInput,
  type CreatePeriodInput,
  type UpdateCategoryInput,
  type UpdatePeriodInput,
} from "./service.ts";

import { idParams as projectIdParams } from "../../lib/schemas.ts";

const categoryParams = {
  type: "object",
  required: ["id", "categoryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    categoryId: { type: "string", minLength: 1 },
  },
} as const;

const periodParams = {
  type: "object",
  required: ["id", "periodId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    periodId: { type: "string", minLength: 1 },
  },
} as const;

const createCategoryBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 160 },
    costCode: { type: "string", maxLength: 60 },
    planned: { type: "number", minimum: 0 },
    committed: { type: "number", minimum: 0 },
    actual: { type: "number", minimum: 0 },
    notes: { type: "string", maxLength: 2000 },
  },
} as const;

const updateCategoryBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createCategoryBody.properties,
} as const;

const periodSchema = {
  type: "string",
  pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
} as const;

const createPeriodBody = {
  type: "object",
  required: ["period"],
  additionalProperties: false,
  properties: {
    period: periodSchema,
    planned: { type: "number", minimum: 0 },
    actual: { type: "number", minimum: 0 },
    notes: { type: "string", maxLength: 2000 },
  },
} as const;

const updatePeriodBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createPeriodBody.properties,
} as const;

const budgetRoutes: FastifyPluginAsync = async (fastify) => {
  const service = budgetService(budgetRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/budget",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateCategoryInput }>(
    "/projects/:id/budget/categories",
    { schema: { params: projectIdParams, body: createCategoryBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const category = await service.createCategory(project.id, request.body);
      return reply.status(201).send(category);
    },
  );

  fastify.put<{
    Params: { id: string; categoryId: string };
    Body: UpdateCategoryInput;
  }>(
    "/projects/:id/budget/categories/:categoryId",
    { schema: { params: categoryParams, body: updateCategoryBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.updateCategory(
        project.id,
        request.params.categoryId,
        request.body,
      );
    },
  );

  fastify.delete<{ Params: { id: string; categoryId: string } }>(
    "/projects/:id/budget/categories/:categoryId",
    { schema: { params: categoryParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.removeCategory(project.id, request.params.categoryId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreatePeriodInput }>(
    "/projects/:id/budget/periods",
    { schema: { params: projectIdParams, body: createPeriodBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const period = await service.createPeriod(project.id, request.body);
      return reply.status(201).send(period);
    },
  );

  fastify.put<{
    Params: { id: string; periodId: string };
    Body: UpdatePeriodInput;
  }>(
    "/projects/:id/budget/periods/:periodId",
    { schema: { params: periodParams, body: updatePeriodBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.updatePeriod(
        project.id,
        request.params.periodId,
        request.body,
      );
    },
  );

  fastify.delete<{ Params: { id: string; periodId: string } }>(
    "/projects/:id/budget/periods/:periodId",
    { schema: { params: periodParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.removePeriod(project.id, request.params.periodId);
      return reply.status(204).send();
    },
  );
};

export default budgetRoutes;
