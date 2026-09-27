import type { FastifyPluginAsync } from "fastify";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import type { PeriodBillingLine } from "../stages/types.ts";
import { payApplicationService, type ProgressByStage, type StageInfo } from "./pay-application.ts";
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

const PERIOD_PATTERN = "^[0-9]{4}-(0[1-9]|1[0-2])$";

const periodQuery = {
  type: "object",
  additionalProperties: false,
  properties: { period: { type: "string", pattern: PERIOD_PATTERN } },
} as const;

const payApplicationBody = {
  type: "object",
  required: ["lines"],
  additionalProperties: false,
  properties: {
    /** The billing-sheet month this application invoices; flags it as billed. */
    period: { type: "string", pattern: PERIOD_PATTERN },
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
  // Only the sheet-facing half of the stages service is needed here; no
  // building lookup, contract-sum check or claim-chain hook applies.
  const schedule = stagesService(stages, async () => undefined);
  const service = payApplicationService(
    repository,
    async (projectId) => {
      const rows = await stages.listByProject(projectId);
      const map = new Map<string, StageInfo>();
      for (const row of rows) {
        map.set(row.id, { name: row.name, value: Number(row.value) });
      }
      return map;
    },
    async (projectId) => {
      const lines = await schedule.listScheduleOfValues(projectId);
      const progress: ProgressByStage = new Map();
      for (const line of lines) {
        const month: PeriodBillingLine = {
          period: line.period,
          cumulativePct: line.percentComplete,
          periodPct: line.periodPercent,
          periodAmount: line.periodAmount,
          toDateAmount: line.toDateAmount,
        };
        const bucket = progress.get(line.stageId);
        if (bucket) bucket.push(month);
        else progress.set(line.stageId, [month]);
      }
      return progress;
    },
    (projectId, period, stageIds) => schedule.markPeriodBilled(projectId, period, stageIds),
  );

  fastify.get<{ Params: { id: string; invoiceId: string }; Querystring: { period?: string } }>(
    "/projects/:id/invoices/:invoiceId/pay-application",
    { schema: { params: invoiceParams, querystring: periodQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.get(project.id, request.params.invoiceId, request.query.period);
    },
  );

  fastify.put<{
    Params: { id: string; invoiceId: string };
    Body: { lines: PayApplicationLineInput[]; period?: string };
  }>(
    "/projects/:id/invoices/:invoiceId/pay-application",
    { schema: { params: invoiceParams, body: payApplicationBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      return service.set(project.id, request.params.invoiceId, request.body.lines, request.body.period);
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
