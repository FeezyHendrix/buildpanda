import type { FastifyPluginAsync } from "fastify";
import { assertProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";
import { materialsLedgerRepository } from "../materials-ledger/repository.ts";
import { materialsLedgerService } from "../materials-ledger/service.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { toContractTerms } from "../finances/contract-terms.ts";
import { financesRepository } from "../finances/repository.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import invoiceCertificateRoutes from "./certificate-routes.ts";
import { createInvoiceBody, editInvoiceBody, sendInvoiceBody } from "./invoice-schemas.ts";
import { invoiceCertificateRepository } from "./certificate-repository.ts";
import { invoiceCertificateService } from "./certificate.ts";
import { invoiceNotifier } from "./invoice-notifier.ts";
import { INVOICE_EMAIL_QUEUE, type InvoiceEmailJobData } from "./invoice-send-job.ts";
import { invoiceMaterialSyncer } from "./invoice-material-sync.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";
import { invoicesRepository } from "./repository.ts";
import { invoicesScanService } from "./scan-service.ts";
import { invoicesService } from "./service.ts";
import {
  type CreateInvoiceInput,
  type EditInvoiceInput,
  type SendInvoiceInput,
} from "./types.ts";

const invoiceParams = {
  type: "object",
  required: ["id", "invoiceId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    invoiceId: { type: "string", minLength: 1 },
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

const scanInvoiceBody = {
  type: "object",
  required: ["fileId"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = invoicesRepository(fastify.db);
  const contracts = contractsRepository(fastify.db);
  // A receivable certificate bills against the main contract unless it names
  // another one, so the contract waterfall can actually see it.
  const service = invoicesService(repository, {
    mainContractId: async (projectId) => (await contracts.findMain(projectId))?.id ?? null,
  });
  const finances = financesRepository(fastify.db);
  const notifier = invoiceNotifier(
    notificationsService(notificationsRepository(fastify.db), fastify.queue),
    fastify.db,
  );
  const certificates = invoiceCertificateService({
    invoices: repository,
    certificates: invoiceCertificateRepository(fastify.db),
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
  await fastify.register(invoiceCertificateRoutes);
  const scanService = invoicesScanService(fastify.db);
  const materialSyncer = invoiceMaterialSyncer({
    db: fastify.db,
    materialsEquipment: materialsEquipmentService(materialsEquipmentRepository(fastify.db)),
    materialsLedger: materialsLedgerService(materialsLedgerRepository(fastify.db)),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateInvoiceInput }>(
    "/projects/:id/invoices",
    { schema: { params: projectIdParams, body: createInvoiceBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
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
      if (invoice.invoiceType === "material") {
        try {
          const syncResult = await materialSyncer.sync(project.id, invoice, user.id);
          if (syncResult.warnings.length > 0) {
            request.log.warn(
              { invoiceId: invoice.id, syncResult },
              "Invoice → materials sync completed with warnings",
            );
          }
        } catch (err) {
          request.log.error(
            { err, invoiceId: invoice.id },
            "Invoice → materials sync failed; invoice was still saved",
          );
        }
      }
      return reply.status(201).send(invoice);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { fileId: string } }>(
    "/projects/:id/invoices/scan",
    { schema: { params: projectIdParams, body: scanInvoiceBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return scanService.scanUploadedFile(project.id, request.body.fileId);
    },
  );

  fastify.put<{ Params: { id: string; invoiceId: string }; Body: EditInvoiceInput }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams, body: editInvoiceBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      const user = request.requireAuth();
      const status = request.body.status;
      if (status === "Approved") {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      const before = await repository.findById(request.params.invoiceId);
      const invoice = await service.edit(project.id, request.params.invoiceId, request.body);
      const row = await repository.findById(invoice.id);
      if (row && before && status !== undefined && row.status !== before.status) {
        await certificates.logStatusChange(
          row,
          status === "Approved" ? "approved" : "sent",
          { id: user.id, name: user.name },
          before.status,
          row.status,
        );
      }
      return invoice;
    },
  );

  fastify.delete<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      // A certificate with money recorded against it is voided, never deleted.
      await certificates.assertRemovable(project.id, request.params.invoiceId);
      await service.remove(project.id, request.params.invoiceId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/pdf",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
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
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      const before = await repository.findById(request.params.invoiceId);
      const invoice = await service.markSent(project.id, request.params.invoiceId, request.body);
      const sentRow = await repository.findById(invoice.id);
      if (sentRow && before) {
        const user = request.requireAuth();
        await certificates.logStatusChange(
          sentRow,
          "sent",
          { id: user.id, name: user.name },
          before.status,
          sentRow.status,
        );
      }
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

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/allocations",
    { schema: { params: invoiceParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
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
