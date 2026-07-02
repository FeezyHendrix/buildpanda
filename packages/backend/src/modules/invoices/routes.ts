import type { FastifyPluginAsync } from "fastify";
import { assertProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { INVOICE_EMAIL_QUEUE, type InvoiceEmailJobData } from "./invoice-send-job.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";
import { invoicesRepository } from "./repository.ts";
import {
  invoicesService,
  type AddPaymentInput,
  type CreateInvoiceInput,
  type EditInvoiceInput,
  type SendInvoiceInput,
} from "./service.ts";

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

const allocationsBody = {
  type: "object",
  required: ["allocations"],
  additionalProperties: false,
  properties: {
    allocations: {
      type: "array",
      items: {
        type: "object",
        required: ["budgetCategoryId", "amount"],
        additionalProperties: false,
        properties: {
          budgetCategoryId: { type: "string", minLength: 1 },
          amount: { type: "number", minimum: 0 },
        },
      },
    },
  },
} as const;

const statusSchema = {
  type: "string",
  enum: ["Draft", "Sent", "Submitted", "Approved"],
} as const;

const invoiceTypeSchema = {
  type: "string",
  enum: ["progress", "final", "variation", "vendor", "material"],
} as const;

const partySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"], maxLength: 200 },
    address: { type: ["string", "null"], maxLength: 500 },
    tin: { type: ["string", "null"], maxLength: 100 },
    firsNumber: { type: ["string", "null"], maxLength: 100 },
    email: { type: ["string", "null"], maxLength: 200 },
    bank: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        accountName: { type: ["string", "null"], maxLength: 200 },
        accountNumber: { type: ["string", "null"], maxLength: 100 },
        bankName: { type: ["string", "null"], maxLength: 200 },
      },
    },
  },
} as const;

const lineItemSchema = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    description: { type: "string", minLength: 1, maxLength: 1000 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string", maxLength: 50 },
    unitRate: { type: "number", minimum: 0 },
    budgetCategoryId: { type: "string", minLength: 1 },
    isVariation: { type: "boolean" },
  },
} as const;

const methodSchema = {
  type: "string",
  enum: ["Bank Transfer", "Cash", "Card", "Cheque", "Other"],
} as const;

const createInvoiceBody = {
  type: "object",
  required: ["vendorName", "trade"],
  additionalProperties: false,
  properties: {
    vendorName: { type: "string", minLength: 1, maxLength: 200 },
    trade: { type: "string", minLength: 1, maxLength: 120 },
    number: { type: "string", maxLength: 100 },
    status: statusSchema,
    amount: { type: "number", minimum: 0 },
    retainagePercentage: { type: "number", minimum: 0, maximum: 100 },
    invoiceType: invoiceTypeSchema,
    currency: { type: "string", minLength: 1, maxLength: 10 },
    vatRate: { type: "number", minimum: 0, maximum: 100 },
    whtRate: { type: "number", minimum: 0, maximum: 100 },
    retentionRate: { type: "number", minimum: 0, maximum: 100 },
    issueDate: { type: "string", maxLength: 30 },
    dueDate: { type: "string", maxLength: 30 },
    notes: { type: "string", maxLength: 2000 },
    fromParty: { ...partySchema, type: ["object", "null"] },
    toParty: { ...partySchema, type: ["object", "null"] },
    recipientEmail: { type: "string", maxLength: 200 },
    ccEmails: { type: "array", items: { type: "string", maxLength: 200 } },
    bccEmails: { type: "array", items: { type: "string", maxLength: 200 } },
    poReferenceId: { type: "string", minLength: 1 },
    paymentClaimId: { type: "string", minLength: 1 },
    milestonePaymentId: { type: "string", minLength: 1 },
    contractReference: { type: "string", maxLength: 200 },
    paymentTerms: { type: "string", maxLength: 1000 },
    paymentInstructions: { type: "string", maxLength: 2000 },
    coverNote: { type: "string", maxLength: 4000 },
    headerText: { type: "string", maxLength: 2000 },
    footerText: { type: "string", maxLength: 2000 },
    lineItems: { type: "array", items: lineItemSchema },
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

const sendInvoiceBody = {
  type: "object",
  required: ["recipientEmail"],
  additionalProperties: false,
  properties: {
    recipientEmail: { type: "string", minLength: 1, maxLength: 200 },
    cc: { type: "array", items: { type: "string", maxLength: 200 } },
    bcc: { type: "array", items: { type: "string", maxLength: 200 } },
    coverNote: { type: "string", maxLength: 4000 },
    headerText: { type: "string", maxLength: 2000 },
    footerText: { type: "string", maxLength: 2000 },
  },
} as const;

const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = invoicesService(invoicesRepository(fastify.db));
  const repository = invoicesRepository(fastify.db);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateInvoiceInput }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams, body: createInvoiceBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const status = request.body.status;
      if (status === "Approved") {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      const invoice = await service.create(project.id, request.body);
      return reply.status(201).send(invoice);
    },
  );

  fastify.put<{ Params: { id: string; invoiceId: string }; Body: EditInvoiceInput }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams, body: editInvoiceBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const status = request.body.status;
      if (status === "Approved") {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      return service.edit(project.id, request.params.invoiceId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.invoiceId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/pdf",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await request.requireProjectAccess(request.params.id);
      const invoice = await service.get(project.id, request.params.invoiceId);
      const org = await repository.organizationForProject(project.id);
      const pdf = await renderInvoicePdf(invoice, org ?? null);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `inline; filename="invoice-${encodeURIComponent(invoice.number ?? invoice.id)}.pdf"`);
      return reply.send(pdf);
    },
  );

  fastify.post<{
    Params: { id: string; invoiceId: string };
    Body: SendInvoiceInput;
  }>(
    "/projects/:id/invoices/:invoiceId/send",
    { schema: { params: invoiceParams, body: sendInvoiceBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const invoice = await service.markSent(project.id, request.params.invoiceId, request.body);
      await fastify.queue.enqueue<InvoiceEmailJobData>(INVOICE_EMAIL_QUEUE, "send", {
        invoiceId: invoice.id,
        recipientEmail: invoice.recipientEmail ?? request.body.recipientEmail,
        cc: invoice.ccEmails,
        bcc: invoice.bccEmails,
        coverNote: invoice.coverNote,
        headerText: invoice.headerText,
        footerText: invoice.footerText,
      });
      return invoice;
    },
  );

  fastify.post<{
    Params: { id: string; invoiceId: string };
    Body: AddPaymentInput;
  }>(
    "/projects/:id/invoices/:invoiceId/payments",
    { schema: { params: invoiceParams, body: addPaymentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "approve");
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
      const project = await request.requireProjectPermission(request.params.id, "finances", "approve");
      return service.removePayment(
        project.id,
        request.params.invoiceId,
        request.params.paymentId,
      );
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/allocations",
    { schema: { params: invoiceParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getAllocations(project.id, request.params.invoiceId);
    },
  );

  fastify.put<{
    Params: { id: string; invoiceId: string };
    Body: { allocations: { budgetCategoryId: string; amount: number }[] };
  }>(
    "/projects/:id/invoices/:invoiceId/allocations",
    { schema: { params: invoiceParams, body: allocationsBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "approve");
      return service.setAllocations(
        project.id,
        request.params.invoiceId,
        request.body.allocations,
      );
    },
  );
};

export default invoiceRoutes;
