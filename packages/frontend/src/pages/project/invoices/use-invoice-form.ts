import { useMemo, useState } from "react";
import {
  EMPTY_INVOICE,
  computeTotals,
  countValidLines,
  emptyLine,
  isInvoiceValid,
  type InvoiceTotals,
  type UpsertInvoiceValues,
  type UpsertLineItem,
} from "./invoice-form-model";

export interface InvoiceFormApi {
  values: UpsertInvoiceValues;
  totals: InvoiceTotals;
  isValid: boolean;
  validLineCount: number;
  update: <K extends keyof UpsertInvoiceValues>(
    key: K,
    value: UpsertInvoiceValues[K],
  ) => void;
  updateLine: (index: number, patch: Partial<UpsertLineItem>) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  reset: (next: UpsertInvoiceValues) => void;
}

export function useInvoiceForm(
  initial?: UpsertInvoiceValues,
): InvoiceFormApi {
  const [values, setValues] = useState<UpsertInvoiceValues>(
    initial ?? EMPTY_INVOICE,
  );

  function update<K extends keyof UpsertInvoiceValues>(
    key: K,
    value: UpsertInvoiceValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(index: number, patch: Partial<UpsertLineItem>): void {
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) =>
        i === index ? { ...li, ...patch } : li,
      ),
    }));
  }

  function addLine(): void {
    setValues((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, emptyLine()],
    }));
  }

  function removeLine(index: number): void {
    setValues((prev) => ({
      ...prev,
      lineItems:
        prev.lineItems.length > 1
          ? prev.lineItems.filter((_, i) => i !== index)
          : prev.lineItems,
    }));
  }

  function reset(next: UpsertInvoiceValues): void {
    setValues(next);
  }

  const totals = useMemo(() => computeTotals(values), [values]);
  const validLineCount = countValidLines(values);
  const isValid = isInvoiceValid(values);

  return {
    values,
    totals,
    isValid,
    validLineCount,
    update,
    updateLine,
    addLine,
    removeLine,
    reset,
  };
}
