import { BudgetCategory, BudgetPeriod } from "@/hooks/use-budget";
import { UpsertBudgetCategoryValues } from "@/components/molecules/upsert-budget-category-dialog";
import { UpsertBudgetPeriodValues } from "@/components/molecules/upsert-budget-period-dialog";

export function toCategoryInput(values: UpsertBudgetCategoryValues) {
  return {
    name: values.name,
    costCode: values.costCode || undefined,
    planned: values.planned ? Number(values.planned) : undefined,
    committed: values.committed ? Number(values.committed) : undefined,
    actual: values.actual ? Number(values.actual) : undefined,
    notes: values.notes || undefined,
  };
}

export function toCategoryValues(cat: BudgetCategory): UpsertBudgetCategoryValues {
  return {
    name: cat.name,
    costCode: cat.costCode ?? "",
    planned: String(cat.planned),
    committed: String(cat.committed),
    actual: String(cat.actual),
    notes: cat.notes ?? "",
  };
}

export function toPeriodInput(values: UpsertBudgetPeriodValues) {
  return {
    period: values.period,
    planned: values.planned ? Number(values.planned) : undefined,
    actual: values.actual ? Number(values.actual) : undefined,
    notes: values.notes || undefined,
  };
}

export function toPeriodValues(period: BudgetPeriod): UpsertBudgetPeriodValues {
  return {
    period: period.period,
    planned: String(period.planned),
    actual: String(period.actual),
    notes: period.notes ?? "",
  };
}

export function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}
