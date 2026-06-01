import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { assertCanModifyProject } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { invoicesRepository } from "./repository.ts";
import {
  invoicesService,
  type AddPaymentInput,
  type CreateInvoiceInput,
  type EditInvoiceInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const invoiceParams = {
  type: "object",
  required: ["id", "invoiceId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    invoiceId: { type: "string", minLength: 1 },
  },
} as const;

const paymentParams = {
  type: "object",
  required: ["id", "invoiceId", "paymentId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    invoiceId: { type: "string", minLength: 1 },
    paymentId: { type: "string", minLength: 1 },
  },
} as const;

const statusSchema = {
  type: "string",
  enum: ["Draft", "Submitted", "Approved", "Paid"],
} as const;

const methodSchema = {
  type: "string",
  enum: ["Bank Transfer", "Cash", "Card", "Cheque", "Other"],
} as const;

const createInvoiceBody = {
  type: "object",
  required: ["vendorName", "trade", "amount"],
  additionalProperties: false,
  properties: {
    vendorName: { type: "string", minLength: 1, maxLength: 200 },
    trade: { type: "string", minLength: 1, maxLength: 120 },
    number: { type: "string", maxLength: 100 },
    status: statusSchema,
    amount: { type: "number", minimum: 0 },
    retainagePercentage: { type: "number", minimum: 0, maximum: 100 },
    issueDate: { type: "string", maxLength: 30 },
    dueDate: { type: "string", maxLength: 30 },
    notes: { type: "string", maxLength: 2000 },
  },
} as const;

const editInvoiceBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createInvoiceBody.properties,
} as const;

const addPaymentBody = {
  type: "object",
  required: ["amount"],
  additionalProperties: false,
  properties: {
    amount: { type: "number", exclusiveMinimum: 0 },
    method: methodSchema,
    paidAt: { type: "string", maxLength: 30 },
    note: { type: "string", maxLength: 500 },
  },
} as const;

const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = invoicesService(invoicesRepository(fastify.db));

  async function requireModifiableProject(
    request: FastifyRequest,
  ) {
    const user = request.requireAuth();
    const project = await projects.findById(
      (request.params as { id: string }).id,
    );
    if (!project) throw new NotFoundError("Project");
    assertCanModifyProject(
      { ownerId: project.owner_id, organizationId: project.organization_id },
      { userId: user.id, orgRoles: request.orgRoles },
    );
    return project;
  }

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateInvoiceInput }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams, body: createInvoiceBody } },
    async (request, reply) => {
      const project = await requireModifiableProject(request);
      const invoice = await service.create(project.id, request.body);
      return reply.status(201).send(invoice);
    },
  );

  fastify.put<{ Params: { id: string; invoiceId: string }; Body: EditInvoiceInput }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams, body: editInvoiceBody } },
    async (request) => {
      const project = await requireModifiableProject(request);
      return service.edit(project.id, request.params.invoiceId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await requireModifiableProject(request);
      await service.remove(project.id, request.params.invoiceId);
      return reply.status(204).send();
    },
  );

  fastify.post<{
    Params: { id: string; invoiceId: string };
    Body: AddPaymentInput;
  }>(
    "/projects/:id/invoices/:invoiceId/payments",
    { schema: { params: invoiceParams, body: addPaymentBody } },
    async (request, reply) => {
      const project = await requireModifiableProject(request);
      const invoice = await service.addPayment(
        project.id,
        request.params.invoiceId,
        request.body,
      );
      return reply.status(201).send(invoice);
    },
  );

  fastify.delete<{ Params: { id: string; invoiceId: string; paymentId: string } }>(
    "/projects/:id/invoices/:invoiceId/payments/:paymentId",
    { schema: { params: paymentParams } },
    async (request) => {
      const project = await requireModifiableProject(request);
      return service.removePayment(
        project.id,
        request.params.invoiceId,
        request.params.paymentId,
      );
    },
  );
};

export default invoiceRoutes;
