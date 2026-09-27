import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { purchaseOrdersRepository } from "../purchase-orders/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { transactionsRepository } from "../transactions/repository.ts";
import { financeSummaryService } from "./finance-summary.ts";
import { financesRepository } from "./repository.ts";
import { stageCostsService } from "./stage-costs.ts";
import { financeSummaryRepository } from "./summary-repository.ts";

const summaryResponse = {
  200: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      currency: { type: "string" },
      contractSum: { type: "number" },
      variationsTotal: { type: "number" },
      adjustedContract: { type: "number" },
      certifiedGrossToDate: { type: "number" },
      amountPaidToDate: { type: "number" },
      retentionHeld: { type: "number" },
      advanceRecovered: { type: "number" },
      outstanding: { type: "number" },
      unpaidCertified: { type: "number" },
      funding: {
        type: "object",
        properties: { deposited: { type: "number" }, released: { type: "number" } },
      },
      ldExposure: {
        type: ["object", "null"],
        properties: {
          daysLate: { type: "integer" },
          ratePerDay: { type: "number" },
          capAmount: { type: ["number", "null"] },
          amount: { type: "number" },
          againstDate: { type: "string" },
        },
      },
      eot: {
        type: ["object", "null"],
        properties: { daysApproved: { type: "integer" }, daysPending: { type: "integer" } },
      },
      completionDate: { type: ["string", "null"] },
      revisedCompletionDate: { type: ["string", "null"] },
      phases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stageId: { type: "string" },
            name: { type: "string" },
            scheduledValue: { type: "number" },
            budget: { type: "number" },
            budgetSource: { type: "string", enum: ["expected_cost", "scheduled_value"] },
            committed: { type: "number" },
            actual: { type: "number" },
            variance: { type: "number" },
          },
        },
      },
    },
  },
} as const;

/**
 * The single contract position: certified from approved receivable
 * certificates, paid from the receipts recorded on them, funding kept to one
 * side. Everything here is a figure a human recorded, never a movement the
 * system made.
 */
const financeSummaryRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = financesRepository(fastify.db);
  const stages = stagesRepository(fastify.db);
  const summary = financeSummaryService({
    finances: repository,
    summary: financeSummaryRepository(fastify.db),
    stageCosts: stageCostsService({
      finances: repository,
      transactions: transactionsRepository(fastify.db),
      purchaseOrders: purchaseOrdersRepository(fastify.db),
    }),
    stages: async (projectId) =>
      (await stages.listByProject(projectId)).map((row) => ({
        stageId: row.id,
        name: row.name,
        scheduledValue: Number(row.value),
        expectedCost: Number(row.expected_cost ?? 0),
      })),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/finances/summary",
    { schema: { params: projectIdParams, response: summaryResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return summary.get(project.id);
    },
  );
};

export default financeSummaryRoutes;
