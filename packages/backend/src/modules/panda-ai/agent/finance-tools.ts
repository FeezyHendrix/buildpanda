import { contractsRepository } from "../../contracts/repository.ts";
import { contractsService } from "../../contracts/service.ts";
import { dailyLogsRepository } from "../../daily-logs/repository.ts";
import { documentsRepository } from "../../documents/repository.ts";
import { financeSummaryService } from "../../finances/finance-summary.ts";
import { financesRepository } from "../../finances/repository.ts";
import { stageCostsService } from "../../finances/stage-costs.ts";
import { financeSummaryRepository } from "../../finances/summary-repository.ts";
import { invoicesRepository } from "../../invoices/repository.ts";
import { invoicesService } from "../../invoices/service.ts";
import { INVOICE_WORKFLOW_STATUSES } from "../../invoices/types.ts";
import { purchaseOrdersRepository } from "../../purchase-orders/repository.ts";
import { phaseRollup } from "../../stages/phase-rollup.ts";
import { stagesRepository } from "../../stages/repository.ts";
import { stagesService } from "../../stages/service.ts";
import { transactionsRepository } from "../../transactions/repository.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";
import type { ToolContext } from "./tools.ts";

function contractsFor(ctx: ToolContext) {
  const finances = financesRepository(ctx.db);
  const stages = stagesRepository(ctx.db);
  return contractsService(contractsRepository(ctx.db), {
    finances,
    stages,
    documents: documentsRepository(ctx.db),
  });
}

// The same wiring the stages route plugin uses, so the assistant reads the
// exact estimate-vs-used figures the Phases tab shows.
function phasesFor(ctx: ToolContext, contracts: ReturnType<typeof contractsFor>) {
  return stagesService(stagesRepository(ctx.db), async () => undefined, undefined, undefined, {
    rollup: phaseRollup({
      dailyLogs: dailyLogsRepository(ctx.db),
      purchaseOrders: purchaseOrdersRepository(ctx.db),
      transactions: transactionsRepository(ctx.db),
      mainContractId: (projectId) => contracts.mainContractId(projectId),
    }),
    contractBelongsToProject: (projectId, contractId) => contracts.belongsToProject(projectId, contractId),
  });
}

/** Read tools over the contract records, the phase estimates and invoice payments. */
export function financeTools(): AgentTool[] {
  return [
    tool(fn("get_finance_position", "THE answer to 'what is outstanding on the contract', 'how much have we been paid', 'what is owed', 'are we exposed to liquidated damages': the single contract position. Returns the original contract sum, approved variations and the adjusted contract; gross certified to date (from approved receivable certificates only); amount paid to date (from the receipts recorded on those certificates); retention held; advance recovered; outstanding (adjusted contract MINUS certified — still to certify); unpaid certified (certified MINUS paid — certified and awaiting payment); the funding ledger (deposits and milestone releases, which are NOT part of the contract waterfall); liquidated-damages exposure (days late beyond the revised completion date times the daily rate, capped); approved and pending extension-of-time days; and cost versus budget per build stage with the source of each budget figure. Prefer this over get_contracts and get_finances for any 'what is outstanding / owed / paid / late' question. Every figure is a record of money a human moved off-platform; BuildPanda never transacts."), async (ctx) => {
      const repository = financesRepository(ctx.db);
      const stages = stagesRepository(ctx.db);
      const position = await financeSummaryService({
        finances: repository,
        summary: financeSummaryRepository(ctx.db),
        stageCosts: stageCostsService({
          finances: repository,
          transactions: transactionsRepository(ctx.db),
          purchaseOrders: purchaseOrdersRepository(ctx.db),
        }),
        stages: async (projectId) =>
          (await stages.listByProject(projectId)).map((row) => ({
            stageId: row.id,
            name: row.name,
            scheduledValue: Number(row.value),
            expectedCost: Number(row.expected_cost ?? 0),
          })),
      }).get(ctx.projectId);

      const invoices = await invoicesService(invoicesRepository(ctx.db)).listByProject(ctx.projectId);
      const receivable = invoices.filter((i) => i.direction === "receivable" && i.voidedAt === null);
      return {
        output: {
          contract: {
            currency: position.currency,
            originalSum: position.contractSum,
            approvedVariations: position.variationsTotal,
            adjustedContract: position.adjustedContract,
            completionDate: position.completionDate,
            revisedCompletionDate: position.revisedCompletionDate,
          },
          certifiedGrossToDate: position.certifiedGrossToDate,
          amountPaidToDate: position.amountPaidToDate,
          retentionHeld: position.retentionHeld,
          advanceRecovered: position.advanceRecovered,
          outstandingToCertify: position.outstanding,
          certifiedAwaitingPayment: position.unpaidCertified,
          // Deposits and milestone releases are a separate funding ledger; they
          // are NOT certification and NOT payment against the contract.
          funding: position.funding,
          liquidatedDamagesExposure: position.ldExposure,
          extensionOfTime: position.eot,
          latePayments: receivable
            .filter((i) => i.paidLateDays !== null)
            .map((i) => ({ number: i.number, dueDate: i.dueDate, daysLate: i.paidLateDays })),
          overdueCertificates: receivable
            .filter((i) => i.overdueDays !== null)
            .map((i) => ({
              number: i.number,
              dueDate: i.dueDate,
              daysOverdue: i.overdueDays,
              outstanding: i.balanceDue,
            })),
          costVsBudgetByStage: position.phases.map((p) => ({
            stage: p.name,
            scheduledValue: p.scheduledValue,
            budget: p.budget,
            budgetSource: p.budgetSource,
            committed: p.committed,
            actual: p.actual,
            variance: p.variance,
          })),
        },
      };
    }),

    tool(fn("get_contracts", "Get the project's contracts — the main contract (mirrors the contract sum) and one change-order contract per approved change request — each with its status (Draft, Pending, Signed), total, trade, legal entity, whether the signed document is on file and how many build stages sit on it; plus every build stage's estimate vs used figures: scheduled value, expected cost, estimated labour hours, labour and material budgets against labour hours logged in daily logs, material cost committed on purchase orders and total cost (materials + logged expenses). Use for questions about contracts, what is signed or pending, change-order contracts, or how a stage is tracking against its estimate. BuildPanda only LOGS these records; it does not move money."), async (ctx) => {
      const contracts = contractsFor(ctx);
      const [contractRows, stages] = await Promise.all([
        contracts.listByProject(ctx.projectId),
        phasesFor(ctx, contracts).list(ctx.projectId),
      ]);
      const titleById = new Map(contractRows.map((c) => [c.id, c.title]));
      return {
        output: {
          contracts: contractRows.map((c) => ({
            id: c.id,
            kind: c.kind,
            title: c.title,
            status: c.status,
            total: c.total,
            trade: c.trade,
            legalEntity: c.legalEntity,
            signedAt: c.signedAt,
            signedDocumentOnFile: c.documentId !== null,
            changeRequestId: c.changeRequestId,
            phaseCount: c.phaseCount,
          })),
          phases: stages.map((s) => ({
            stage: s.name,
            status: s.status,
            contract: s.contractId ? (titleById.get(s.contractId) ?? s.contractId) : null,
            scheduledValue: s.value,
            expectedCost: s.expectedCost,
            estimatedLaborHours: s.estimatedLaborHours,
            laborBudget: s.laborBudget,
            materialBudget: s.materialBudget,
            usedLaborHours: s.usedLaborHours,
            usedMaterialCost: s.usedMaterialCost,
            totalCost: s.totalCost,
            costVariance: round2(s.expectedCost - s.totalCost),
          })),
        },
      };
    }),

    tool(fn("get_invoices", "Get the project's invoices in detail: number, vendor, billed-to party, workflow status and what it may move to next, the billing month, issue/due dates, total, amount paid, outstanding balance, an isOverdue flag and every payment recorded against it (amount, date, method, note). Use for questions about specific invoices, what is unpaid or overdue, or which payments were recorded and when. get_finances is only the high-level budget summary. Payments are LOGS of money received off-platform.", { status: { type: "string", enum: [...INVOICE_WORKFLOW_STATUSES], description: "Optional workflow status filter" } }), async (ctx, args) => {
      const status = typeof args.status === "string" ? args.status : undefined;
      const invoices = await invoicesService(invoicesRepository(ctx.db)).listByProject(ctx.projectId);
      const now = Date.now();
      return {
        output: invoices
          .filter((i) => !status || i.workflowStatus === status || (status === "Submitted" && i.workflowStatus === "Sent"))
          .slice(0, 100)
          .map((i) => ({
            id: i.id,
            number: i.number,
            vendor: i.vendorName,
            billedTo: i.toParty?.name ?? null,
            type: i.invoiceType,
            status: i.status,
            workflowStatus: i.workflowStatus,
            nextStatuses: i.nextStatuses,
            budgetMonth: i.budgetMonth,
            currency: i.currency,
            issueDate: i.issueDate,
            dueDate: i.dueDate,
            total: i.totalInvoiced,
            netPayable: i.netPayable,
            amountPaid: i.amountPaid,
            outstanding: i.balanceDue,
            isOverdue:
              Boolean(i.dueDate) &&
              new Date(String(i.dueDate)).getTime() < now &&
              i.balanceDue > 0 &&
              i.workflowStatus !== "Draft",
            payments: i.payments.map((p) => ({
              amount: p.amount,
              paidAt: p.paidAt,
              method: p.method,
              note: p.note,
            })),
          })),
      };
    }),
  ];
}
