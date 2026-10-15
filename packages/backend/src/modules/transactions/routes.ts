import type { FastifyPluginAsync } from "fastify";
import { filesService } from "../files/service.ts";
import { filesRepository } from "../files/repository.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { requireFileAttachment } from "../files/access.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { stagesRepository } from "../stages/repository.ts";
import {
  customCategoriesRepository,
  transactionsRepository,
} from "./repository.ts";
import { transactionsService } from "./service.ts";
import { expenseReaderId } from "./access.ts";
import type { AuthorizationRequest, AuthorizedProject } from "../../lib/authorization-request.ts";
import type {
  CreateCustomCategoryInput,
  CreateTransactionInput,
  EditTransactionInput,
  TransactionListFilters,
} from "./types.ts";

const transactionParams = {
  type: "object",
  required: ["id", "transactionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    transactionId: { type: "string", minLength: 1 },
  },
} as const;

const categoryParams = {
  type: "object",
  required: ["id", "categoryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    categoryId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", minLength: 1, maxLength: 200 },
    stageId: { type: "string", minLength: 1, maxLength: 200 },
    from: { type: "string", minLength: 1, maxLength: 30 },
    to: { type: "string", minLength: 1, maxLength: 30 },
    search: { type: "string", minLength: 1, maxLength: 200 },
  },
} as const;

const createTransactionBody = {
  type: "object",
  required: ["title", "category", "amount", "transactedAt"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    category: { type: "string", minLength: 1, maxLength: 200 },
    amount: { type: "number", minimum: 0 },
    transactedAt: { type: "string", minLength: 1, maxLength: 30 },
    vendor: { type: ["string", "null"], maxLength: 200 },
    reference: { type: ["string", "null"], maxLength: 200 },
    receiptFileId: { type: ["string", "null"], maxLength: 200 },
    stageId: { type: ["string", "null"], maxLength: 200 },
    /** A refund or credit note against this category rather than an outlay. */
    credit: { type: "boolean" },
    /** A refundable outlay — a plant-hire deposit, a bond. */
    recoverable: { type: "boolean" },
  },
} as const;

const editTransactionBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createTransactionBody.properties,
} as const;

const createCategoryBody = {
  type: "object",
  required: ["label"],
  additionalProperties: false,
  properties: {
    label: { type: "string", minLength: 1, maxLength: 100 },
    color: { type: ["string", "null"], pattern: "^#[0-9a-fA-F]{6}$" },
  },
} as const;

function toFilters(query: Record<string, unknown>): TransactionListFilters {
  const filters: TransactionListFilters = {};
  if (typeof query.category === "string") filters.category = query.category;
  if (typeof query.stageId === "string") filters.stageId = query.stageId;
  if (typeof query.from === "string") filters.from = query.from;
  if (typeof query.to === "string") filters.to = query.to;
  if (typeof query.search === "string") filters.search = query.search;
  return filters;
}

const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  const files = filesService(filesRepository(fastify.db));
  const fileAccess = fileAccessRepository(fastify.db);
  const stages = stagesRepository(fastify.db);
  const serviceFor = (request: AuthorizationRequest, project: AuthorizedProject) => transactionsService(
    transactionsRepository(fastify.db, expenseReaderId(request, project)),
    customCategoriesRepository(fastify.db),
    {
      stageBelongsToProject: async (projectId, stageId) =>
        (await stages.findById(stageId))?.project_id === projectId,
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/projects/:id/transactions",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "viewCosts",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      return serviceFor(request, project).list(project.id, orgId, toFilters(request.query));
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/projects/:id/transactions/analytics",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "viewCosts",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      return serviceFor(request, project).analytics(project.id, orgId, toFilters(request.query));
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/transactions/categories",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "viewCosts",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      return serviceFor(request, project).listCategories(orgId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateCustomCategoryInput }>(
    "/projects/:id/transactions/categories",
    { schema: { params: projectIdParams, body: createCategoryBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      const user = request.requireAuth();
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      const created = await serviceFor(request, project).createCategory(orgId, user.id, request.body);
      return reply.status(201).send(created);
    },
  );

  fastify.delete<{ Params: { id: string; categoryId: string } }>(
    "/projects/:id/transactions/categories/:categoryId",
    { schema: { params: categoryParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      await serviceFor(request, project).removeCategory(orgId, request.params.categoryId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/projects/:id/transactions/export.csv",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      const csv = await serviceFor(request, project).exportCsv(project.id, orgId, toFilters(request.query));
      const filename = `transactions-${project.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    },
  );

  fastify.get<{ Params: { id: string; transactionId: string } }>(
    "/projects/:id/transactions/:transactionId",
    { schema: { params: transactionParams } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "viewCosts",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      return serviceFor(request, project).get(project.id, orgId, request.params.transactionId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateTransactionInput }>(
    "/projects/:id/transactions",
    { schema: { params: projectIdParams, body: createTransactionBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      const user = request.requireAuth();
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      await requireFileAttachment(request, project.id, request.body.receiptFileId, files, fileAccess);
      const created = await serviceFor(request, project).create(project.id, orgId, user.id, request.body);
      return reply.status(201).send(created);
    },
  );

  fastify.put<{
    Params: { id: string; transactionId: string };
    Body: EditTransactionInput;
  }>(
    "/projects/:id/transactions/:transactionId",
    { schema: { params: transactionParams, body: editTransactionBody } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      const orgId = project.organization_id ?? project.owner_id ?? project.id;
      await requireFileAttachment(request, project.id, request.body.receiptFileId, files, fileAccess);
      return serviceFor(request, project).edit(
        project.id,
        orgId,
        request.params.transactionId,
        request.body,
      );
    },
  );

  fastify.delete<{ Params: { id: string; transactionId: string } }>(
    "/projects/:id/transactions/:transactionId",
    { schema: { params: transactionParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "finances",
        "manage",
      );
      await serviceFor(request, project).remove(project.id, request.params.transactionId);
      return reply.status(204).send();
    },
  );
};

export default transactionRoutes;
