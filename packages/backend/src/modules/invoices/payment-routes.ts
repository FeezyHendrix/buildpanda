import type { FastifyPluginAsync } from "fastify";
import { invoicePaymentsService } from "./invoice-payments.ts";
import { invoicesRepository } from "./repository.ts";
import { invoicesService } from "./service.ts";
import { INVOICE_STATUSES, PAYMENT_METHODS, type AddPaymentInput } from "./types.ts";

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

const addPaymentBody = {
  type: "object",
  required: ["amount"],
  additionalProperties: false,
  properties: {
    amount: { type: "number", exclusiveMinimum: 0 },
    method: { type: "string", enum: PAYMENT_METHODS },
    paidAt: { type: "string", maxLength: 30 },
    note: { type: "string", maxLength: 500 },
  },
} as const;

const paymentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    amount: { type: "number" },
    method: { type: "string", enum: PAYMENT_METHODS },
    paidAt: { type: ["string", "null"] },
    note: { type: ["string", "null"] },
  },
} as const;

const overviewResponse = {
  200: {
    type: "object",
    properties: {
      invoices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            number: { type: ["string", "null"] },
            vendorName: { type: "string" },
            invoiceType: { type: "string" },
            status: { type: "string", enum: INVOICE_STATUSES },
            workflowStatus: { type: "string" },
            currency: { type: "string" },
            issueDate: { type: ["string", "null"] },
            dueDate: { type: ["string", "null"] },
            budgetMonth: { type: ["string", "null"] },
            netPayable: { type: "number" },
            amountPaid: { type: "number" },
            balanceDue: { type: "number" },
            payments: { type: "array", items: paymentSchema },
          },
        },
      },
      totals: {
        type: "object",
        properties: {
          invoiced: { type: "number" },
          paid: { type: "number" },
          outstanding: { type: "number" },
        },
      },
    },
  },
} as const;

// Invoice payments: reading them (the Payments tab) and recording one. A
// payment is a LOG of money the client moved off-platform; nothing is charged.
const invoicePaymentRoutes: FastifyPluginAsync = async (fastify) => {
  const invoices = invoicesService(invoicesRepository(fastify.db));
  const service = invoicePaymentsService(invoices);

  // Static segment declared ahead of /invoices/:invoiceId so it never reads as an id.
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/invoices/payments",
    { schema: { params: projectIdParams, response: overviewResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.overview(project.id);
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/payments",
    { schema: { params: invoiceParams, response: { 200: { type: "array", items: paymentSchema } } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.listForInvoice(project.id, request.params.invoiceId);
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
      const invoice = await invoices.addPayment(
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
      return invoices.removePayment(
        project.id,
        request.params.invoiceId,
        request.params.paymentId,
      );
    },
  );
};

export default invoicePaymentRoutes;
