import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { Money } from "../../lib/money.ts";
import type { NewInvoiceStageLineRecord } from "./repository.ts";
import type {
  InvoiceStageLineRow,
  PayApplicationLine,
  PayApplicationLineInput,
  PayApplicationSummary,
} from "./types.ts";

export interface StageInfo {
  name: string;
  value: number;
}

export interface PayApplicationRepository {
  findById(id: string): Promise<{ project_id: string } | undefined>;
  listStageLines(invoiceId: string): Promise<InvoiceStageLineRow[]>;
  listStageLinesForStages(
    projectId: string,
    stageIds: string[],
  ): Promise<InvoiceStageLineRow[]>;
  replaceStageLines(
    invoiceId: string,
    records: NewInvoiceStageLineRecord[],
  ): Promise<void>;
}

export function payApplicationService(
  repository: PayApplicationRepository,
  stagesForProject: (projectId: string) => Promise<Map<string, StageInfo>>,
) {
  async function ownedInvoice(projectId: string, invoiceId: string): Promise<void> {
    const invoice = await repository.findById(invoiceId);
    if (!invoice || invoice.project_id !== projectId) throw new NotFoundError("Invoice");
  }

  // "Billed in previous applications" (AIA) = everything billed on the stage in
  // OTHER pay-applications; derived, never stored, so it can never go stale.
  async function priorByStage(
    projectId: string,
    invoiceId: string,
    stageIds: string[],
  ): Promise<Map<string, Money>> {
    const map = new Map<string, Money>();
    if (stageIds.length === 0) return map;
    const otherLines = (
      await repository.listStageLinesForStages(projectId, stageIds)
    ).filter((line) => line.invoice_id !== invoiceId);
    for (const line of otherLines) {
      const prior = map.get(line.stage_id) ?? Money.zero();
      map.set(line.stage_id, prior.add(line.this_period).add(line.stored_materials));
    }
    return map;
  }

  function summarize(
    lines: InvoiceStageLineRow[],
    stages: Map<string, StageInfo>,
    prior: Map<string, Money>,
  ): PayApplicationSummary {
    const payLines: PayApplicationLine[] = lines.map((line) => {
      const scheduled = Money.of(line.scheduled_value);
      const thisPeriod = Money.of(line.this_period);
      const stored = Money.of(line.stored_materials);
      const retained = Money.of(line.retained);
      const priorBilled = prior.get(line.stage_id) ?? Money.zero();
      const totalCompleted = priorBilled.add(thisPeriod).add(stored).round(2);
      const balanceToFinish = scheduled.sub(totalCompleted).round(2);
      const currentPaymentDue = thisPeriod.add(stored).sub(retained).round(2);
      const percentComplete = scheduled.isZero()
        ? 0
        : totalCompleted.div(scheduled).mul(100).round(2).toNumber();
      return {
        stageId: line.stage_id,
        stageName: stages.get(line.stage_id)?.name ?? "",
        scheduledValue: scheduled.toNumber(),
        priorBilled: priorBilled.round(2).toNumber(),
        thisPeriod: thisPeriod.toNumber(),
        storedMaterials: stored.toNumber(),
        totalCompleted: totalCompleted.toNumber(),
        percentComplete,
        balanceToFinish: balanceToFinish.toNumber(),
        retained: retained.toNumber(),
        currentPaymentDue: currentPaymentDue.toNumber(),
      };
    });

    const total = (pick: (line: PayApplicationLine) => number): number =>
      Money.sum(payLines.map(pick)).round(2).toNumber();

    return {
      lines: payLines,
      scheduledTotal: total((line) => line.scheduledValue),
      priorBilledTotal: total((line) => line.priorBilled),
      thisPeriodTotal: total((line) => line.thisPeriod),
      storedMaterialsTotal: total((line) => line.storedMaterials),
      totalCompleted: total((line) => line.totalCompleted),
      balanceToFinish: total((line) => line.balanceToFinish),
      retainedTotal: total((line) => line.retained),
      currentPaymentDue: total((line) => line.currentPaymentDue),
    };
  }

  return {
    async get(projectId: string, invoiceId: string): Promise<PayApplicationSummary> {
      await ownedInvoice(projectId, invoiceId);
      const lines = await repository.listStageLines(invoiceId);
      const stages = await stagesForProject(projectId);
      const prior = await priorByStage(
        projectId,
        invoiceId,
        lines.map((line) => line.stage_id),
      );
      return summarize(lines, stages, prior);
    },

    async set(
      projectId: string,
      invoiceId: string,
      inputs: PayApplicationLineInput[],
    ): Promise<PayApplicationSummary> {
      await ownedInvoice(projectId, invoiceId);
      const stages = await stagesForProject(projectId);
      const prior = await priorByStage(
        projectId,
        invoiceId,
        inputs.map((input) => input.stageId),
      );

      const records: NewInvoiceStageLineRecord[] = inputs.map((input, index) => {
        const stage = stages.get(input.stageId);
        if (!stage) throw new BadRequestError("Unknown stage in pay application");
        const scheduled = Money.of(stage.value);
        const thisPeriod = Money.of(input.thisPeriod);
        const stored = Money.of(input.storedMaterials ?? 0);
        const priorBilled = prior.get(input.stageId) ?? Money.zero();
        if (priorBilled.add(thisPeriod).add(stored).gt(scheduled)) {
          throw new BadRequestError("Billing exceeds the stage scheduled value");
        }
        return {
          id: generateId("payln"),
          project_id: projectId,
          invoice_id: invoiceId,
          stage_id: input.stageId,
          scheduled_value: scheduled.toFixed(2),
          this_period: thisPeriod.toFixed(2),
          stored_materials: stored.toFixed(2),
          retained: Money.of(input.retained ?? 0).toFixed(2),
          sort_order: index,
        };
      });

      await repository.replaceStageLines(invoiceId, records);
      const lines = await repository.listStageLines(invoiceId);
      return summarize(lines, stages, prior);
    },
  };
}

export type PayApplicationService = ReturnType<typeof payApplicationService>;
