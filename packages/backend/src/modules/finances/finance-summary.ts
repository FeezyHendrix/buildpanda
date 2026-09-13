import { NotFoundError } from "../../lib/errors.ts";
import { Money } from "../../lib/money.ts";
import { toContractTerms } from "./contract-terms.ts";
import { num } from "./finance-mapper.ts";
import type { FinancesRepository } from "./repository.ts";
import type { StageCostsService } from "./stage-costs.ts";
import type { FinanceSummaryRepository } from "./summary-repository.ts";
import type {
  ContractTerms,
  FinanceSummary,
  LdExposure,
  StageBudgetInput,
  StageBudgetLine,
} from "./types.ts";

export interface FinanceSummaryDeps {
  finances: Pick<FinancesRepository, "findSummary">;
  summary: FinanceSummaryRepository;
  stageCosts: Pick<StageCostsService, "byProject">;
  /** Stage names, scheduled values and estimates, wired from the stages module. */
  stages: (projectId: string) => Promise<StageBudgetInput[]>;
}

function isoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

/**
 * Liquidated damages the employer could levy today: calendar days late beyond
 * the date the contract is actually measured against — the revised completion
 * once an approved EOT moved it — times the daily rate, capped at the agreed
 * share of the adjusted contract. It is an EXPOSURE figure, not a debt: nothing
 * is deducted or transacted, and a pending EOT is not yet a defence, which is
 * why `againstDate` travels with the number.
 */
export function ldExposureFor(
  terms: ContractTerms,
  againstDate: string | null,
  adjustedContract: number,
  today: string,
): LdExposure | null {
  if (!againstDate || terms.liquidatedDamagesRate <= 0) return null;
  const daysLate = Math.max(0, daysBetween(againstDate, today));
  const capAmount =
    terms.liquidatedDamagesCapPercent > 0
      ? Money.of(adjustedContract).mul(terms.liquidatedDamagesCapPercent).round(2).toNumber()
      : null;
  const raw = Money.of(terms.liquidatedDamagesRate).mul(daysLate).round(2).toNumber();
  return {
    daysLate,
    ratePerDay: terms.liquidatedDamagesRate,
    capAmount,
    amount: capAmount === null ? raw : Math.min(raw, capAmount),
    againstDate,
  };
}

/**
 * Cost against budget per stage. When nobody entered an estimate the stage's
 * scheduled value is the budget — otherwise every naira spent reads as an
 * overrun against a budget of zero, which is what the Finance Overview did.
 */
export function stageBudgetLines(
  stages: StageBudgetInput[],
  costs: Map<string, { committed: number; actual: number }>,
): StageBudgetLine[] {
  return stages.map((stage) => {
    const hasEstimate = stage.expectedCost > 0;
    const budget = hasEstimate ? stage.expectedCost : stage.scheduledValue;
    const cost = costs.get(stage.stageId) ?? { committed: 0, actual: 0 };
    const spend = Money.of(cost.committed).add(cost.actual).round(2);
    return {
      stageId: stage.stageId,
      name: stage.name,
      scheduledValue: stage.scheduledValue,
      budget,
      budgetSource: hasEstimate ? "expected_cost" : "scheduled_value",
      committed: cost.committed,
      actual: cost.actual,
      variance: Money.of(budget).sub(spend).round(2).toNumber(),
    };
  });
}

/**
 * The single contract position. Certification comes only from approved
 * receivable invoices and payment only from the payments recorded on them;
 * funding deposits and milestone releases sit in `funding` and never touch the
 * waterfall. Every figure is a record of something a human did off-platform.
 */
export function financeSummaryService(deps: FinanceSummaryDeps) {
  return {
    async get(projectId: string, today = new Date().toISOString().slice(0, 10)): Promise<FinanceSummary> {
      const row = await deps.finances.findSummary(projectId);
      if (!row) throw new NotFoundError("Project finances");

      const [totals, paid, dates, eot, costs, stages] = await Promise.all([
        deps.summary.certifiedTotals(projectId),
        deps.summary.paidTotal(projectId),
        deps.summary.projectDates(projectId),
        deps.summary.eotDays(projectId),
        deps.stageCosts.byProject(projectId).catch(() => ({ stages: [] })),
        deps.stages(projectId).catch(() => []),
      ]);

      const terms = toContractTerms(row);
      const contractSum = num(row.contract_sum);
      const variationsTotal = num(row.variations_total);
      const adjustedContract = Money.of(contractSum).add(variationsTotal).round(2).toNumber();
      const certified = Money.of(totals.certified).round(2);
      const amountPaid = Money.of(paid).round(2);

      const revisedCompletionDate = isoDate(dates.revised_completion_date);
      const completionDate = isoDate(dates.completion_date) ?? terms.completionDate;

      return {
        projectId,
        currency: row.currency,
        contractSum,
        variationsTotal,
        adjustedContract,
        certifiedGrossToDate: certified.toNumber(),
        amountPaidToDate: amountPaid.toNumber(),
        retentionHeld: Money.of(totals.retention).round(2).toNumber(),
        advanceRecovered: Money.of(totals.advance_recovered).round(2).toNumber(),
        outstanding: Money.of(adjustedContract).sub(certified).round(2).toNumber(),
        unpaidCertified: certified.sub(amountPaid).round(2).toNumber(),
        funding: {
          deposited: num(row.funds_deposited),
          released: num(row.funds_released),
        },
        ldExposure: ldExposureFor(
          terms,
          revisedCompletionDate ?? completionDate,
          adjustedContract,
          today,
        ),
        eot: eot ? { daysApproved: Number(eot.approved), daysPending: Number(eot.pending) } : null,
        completionDate,
        revisedCompletionDate,
        phases: stageBudgetLines(
          stages,
          new Map(costs.stages.map((c) => [c.stageId, { committed: c.committed, actual: c.actual }])),
        ),
      };
    },
  };
}

export type FinanceSummaryService = ReturnType<typeof financeSummaryService>;
