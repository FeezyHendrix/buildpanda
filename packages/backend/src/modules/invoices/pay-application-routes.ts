import type { FastifyPluginAsync } from "fastify";
import { stagesRepository } from "../stages/repository.ts";
import { payApplicationService, type StageInfo } from "./pay-application.ts";
import { renderPayApplicationPdf } from "./pay-application-pdf.ts";
import { invoicesRepository } from "./repository.ts";
import { invoicesService } from "./service.ts";
import type { PayApplicationLineInput } from "./types.ts";

const invoiceParams = {
  type: "object",
  required: ["id", "invoiceId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    invoiceId: { type: "string", minLength: 1 },
  },
} as const;

const payApplicationBody = {
  type: "object",
  required: ["lines"],
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        required: ["stageId", "thisPeriod"],
        additionalProperties: false,
        properties: {
          stageId: { type: "string", minLength: 1 },
          thisPeriod: { type: "number", minimum: 0 },
          storedMaterials: { type: "number", minimum: 0 },
          retained: { type: "number", minimum: 0 },
        },
      },
    },
  },
} as const;

const payApplicationRoutes: FastifyPluginAsync = async (fastify) => {
  const stages = stagesRepository(fastify.db);
  const repository = invoicesRepository(fastify.db);
  const invoices = invoicesService(repository);
  const service = payApplicationService(repository, async (projectId) => {
    const rows = await stages.listByProject(projectId);
    const map = new Map<string, StageInfo>();
    for (const row of rows) {
      map.set(row.id, { name: row.name, value: Number(row.value) });
    }
    return map;
  });

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/pay-application",
    { schema: { params: invoiceParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.get(project.id, request.params.invoiceId);
    },
  );

  fastify.put<{
    Params: { id: string; invoiceId: string };
    Body: { lines: PayApplicationLineInput[] };
  }>(
    "/projects/:id/invoices/:invoiceId/pay-application",
    { schema: { params: invoiceParams, body: payApplicationBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return service.set(project.id, request.params.invoiceId, request.body.lines);
    },
  );

  fastify.get<{ Params: { id: string; invoiceId: string } }>(
    "/projects/:id/invoices/:invoiceId/pay-application/pdf",
    { schema: { params: invoiceParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      const [invoice, summary, org] = await Promise.all([
        invoices.get(project.id, request.params.invoiceId),
        service.get(project.id, request.params.invoiceId),
        repository.organizationForProject(project.id),
      ]);
      const pdf = await renderPayApplicationPdf(invoice, summary, org ?? null);
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="pay-application-${encodeURIComponent(invoice.number ?? invoice.id)}.pdf"`,
      );
      return reply.send(pdf);
    },
  );
};

export default payApplicationRoutes;
