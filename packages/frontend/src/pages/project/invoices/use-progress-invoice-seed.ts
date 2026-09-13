import { useMemo } from "react";
import { useProjectFinances } from "@/hooks/use-finances";
import type { PayApplicationLineInput } from "@/hooks/use-invoices";
import { useProjectScheduleOfValues, useStages } from "@/hooks/use-stages";
import { formatPeriodLabel } from "../finances/schedule-of-values-line";
import { EMPTY_INVOICE, emptyLine, type UpsertInvoiceValues } from "./invoice-form-model";

/**
 * Seeds a progress invoice from the billing sheet: for the chosen month, every
 * stage that moved comes in as a line item worth its period amount, in build
 * order, and the same figures become the pay-application lines saved once the
 * invoice exists. The period amounts are priced by the backend
 * (`periodAmount`), so the sheet, the invoice and the application agree to the
 * cent.
 *
 * Retention and VAT come from the CONTRACT TERMS, not from a hard-coded
 * default — an IPC that seeds 0% retention while the contract says 5% is a
 * certificate that says the wrong thing.
 */

export interface ProgressInvoiceSeed {
  /** False while the sheet data is still loading (only when a period is set). */
  ready: boolean;
  values: UpsertInvoiceValues;
  payLines: PayApplicationLineInput[];
}

/** A stored fraction as the percentage the invoice form holds (0.05 → "5"). */
function ratePercent(fraction: number | undefined): string {
  if (fraction === undefined) return "0";
  return String(Math.round(fraction * 1_000_000) / 10_000);
}

export function useProgressInvoiceSeed(
  projectId: string,
  period: string | null | undefined,
  currency: string,
): ProgressInvoiceSeed {
  const enabled = Boolean(period);
  const { data: stages } = useStages(enabled ? projectId : undefined);
  const { data: lines } = useProjectScheduleOfValues(enabled ? projectId : undefined);
  const { data: finances } = useProjectFinances(enabled ? projectId : undefined);

  return useMemo(() => {
    const blank = { ...EMPTY_INVOICE, currency };
    if (!period) return { ready: true, values: blank, payLines: [] };
    if (!stages || !lines) return { ready: false, values: blank, payLines: [] };

    const label = formatPeriodLabel(period);
    const order = new Map(stages.map((stage, index) => [stage.id, index]));
    const nameById = new Map(stages.map((stage) => [stage.id, stage.name]));
    // Build order, not id order — a certificate reads down the works.
    const billed = lines
      .filter((line) => line.period === period && line.periodAmount > 0 && nameById.has(line.stageId))
      .sort((a, b) => (order.get(a.stageId) ?? 0) - (order.get(b.stageId) ?? 0));

    const terms = finances?.contractTerms;

    return {
      ready: true,
      values: {
        ...blank,
        invoiceType: "progress",
        direction: "receivable",
        vendorName: terms?.employerName ?? "",
        trade: "Progress claim",
        retentionRate: ratePercent(terms?.retentionRate),
        vatRate: ratePercent(terms?.vatRate),
        notes: `Progress application for ${label}, raised from the billing sheet.`,
        lineItems:
          billed.length > 0
            ? billed.map((line) => ({
                description: `${nameById.get(line.stageId)} — ${label} progress (${line.percentComplete ?? 0}% complete)`,
                quantity: "1",
                unit: "",
                unitRate: String(line.periodAmount),
              }))
            : [emptyLine()],
      },
      payLines: billed.map((line) => ({ stageId: line.stageId, thisPeriod: line.periodAmount })),
    };
  }, [period, stages, lines, finances, currency]);
}
