import type { FastifyPluginAsync } from "fastify";
import { toContractTerms } from "../finances/contract-terms.ts";
import { financesRepository } from "../finances/repository.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { invoiceNotifier } from "./invoice-notifier.ts";
import { invoiceCertificateRepository } from "./certificate-repository.ts";
import { invoiceCertificateService } from "./certificate.ts";
import { invoicesRepository } from "./repository.ts";
import { INVOICE_EVENT_TYPES, type QueryInvoiceInput, type VoidInvoiceInput } from "./types.ts";

const invoiceParams = {
  type: "object",
  required: ["id", "invoiceId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    invoiceId: { type: "string", minLength: 1 },
  },
} as const;

const reasonBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: { reason: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const historyResponse = {
  200: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string", enum: INVOICE_EVENT_TYPES },
        fromStatus: { type: ["string", "null"] },
        toStatus: { type: ["string", "null"] },
        reason: { type: ["string", "null"] },
        actor: {
          type: "object",
          properties: { id: { type: ["string", "null"] }, name: { type: "string" } },
        },
        amount: { type: ["number", "null"] },
        createdAt: { type: "string" },
      },
    },
  },
} as const;

const certificateResponse = {
  200: {
    type: ["object", "null"],
    properties: {
      number: { type: "integer" },
      previousCertified: { type: "number" },
      thisCertificate: { type: "number" },
      cumulative: { type: "number" },
      retention: { type: "number" },
      vat: { type: "number" },
      advanceRecovery: { type: "number" },
      netPayable: { type: "number" },
    },
  },
} as const;

/**
 * The certificate lifecycle over an invoice: querying it, voiding it, reading
 * the audit trail, and previewing the interim-certificate structure the
 * contract produces for a month's billed lines.
 */
const invoiceCertificateRoutes: FastifyPluginAsync = async (fastify) => {
  const invoices = invoicesRepository(fastify.db);
  const certificates = invoiceCertificateRepository(fastify.db);
  const finances = financesRepository(fastify.db);
  const notifier = invoiceNotifier(
    notificationsService(notificationsRepository(fastify.db), fastify.queue),
    fastify.db,
  );
  const service = invoiceCertificateService({
    invoices,
    certificates,
    terms: async (projectId) => {
      const row = await finances.findSummary(projectId);
      return row ? toContractTerms(row) : null;
    },
    adjustedContract: async (projectId) => {
      const row = await finances.findSummary(projectId);
      return row ? Number(row.contract_sum) + Number(row.variations_total) : 0;
    },
    onEvent: (projectId, invoice, type, actor, reason) =>
      notifier.statusChanged(projectId, invoice, type, actor, reason),
  });

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/history",
    { schema: { params: invoiceParams, response: historyResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.history(project.id, request.params.invoiceId);
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/certificate",
    { schema: { params: invoiceParams, response: certificateResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      const invoice = await service.get(project.id, request.params.invoiceId);
      return service.seed(
        project.id,
        invoice.contractId,
        invoice.lineItems.map((line) => ({ quantity: line.quantity, unitRate: line.unitRate })),
        invoice.id,
      );
    },
  );

  // A client query is a formal dispute on a certificate: it always has a reason,
  // an author and a date, and it holds the ladder until it is answered.
  fastify.post<{ Params: { id: string; invoiceId: string }; Body: QueryInvoiceInput }>(
    "/projects/:id/invoices/:invoiceId/query",
    { schema: { params: invoiceParams, body: reasonBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "dispute");
      const user = request.requireAuth();
      return service.query(project.id, request.params.invoiceId, request.body, {
        id: user.id,
        name: user.name,
      });
    },
  );

  // A paid certificate is an accounting record: it is voided with a reason,
  // which reverses its figures while keeping it and its receipts on file.
  fastify.post<{ Params: { id: string; invoiceId: string }; Body: VoidInvoiceInput }>(
    "/projects/:id/invoices/:invoiceId/void",
    { schema: { params: invoiceParams, body: reasonBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "approve");
      const user = request.requireAuth();
      return service.void(project.id, request.params.invoiceId, request.body, {
        id: user.id,
        name: user.name,
      });
    },
  );
};

export default invoiceCertificateRoutes;
