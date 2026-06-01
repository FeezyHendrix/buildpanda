import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { BudgetRepository } from "./repository.ts";
import type {
  BudgetCategory,
  BudgetCategoryRow,
  BudgetPeriod,
  BudgetPeriodRow,
  BudgetSummary,
  ProjectBudget,
} from "./types.ts";

export interface CreateCategoryInput {
  name: string;
  costCode?: string;
  planned?: number;
  committed?: number;
  actual?: number;
  notes?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  costCode?: string;
  planned?: number;
  committed?: number;
  actual?: number;
  notes?: string;
}

export interface CreatePeriodInput {
  period: string;
  planned?: number;
  actual?: number;
  notes?: string;
}

export interface UpdatePeriodInput {
  period?: string;
  planned?: number;
  actual?: number;
  notes?: string;
}

function num(value: string): number {
  return Number(value);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

function toCategory(row: BudgetCategoryRow): BudgetCategory {
  const planned = num(row.planned);
  const committed = num(row.committed);
  const actual = num(row.actual);
  return {
    id: row.id,
    name: row.name,
    costCode: row.cost_code,
    planned,
    committed,
    actual,
    notes: row.notes,
    variance: round2(planned - committed),
    variancePercentage: pct(planned - committed, planned),
    remaining: round2(planned - actual),
    percentSpent: pct(actual, planned),
  };
}

function toPeriod(row: BudgetPeriodRow): BudgetPeriod {
  const planned = num(row.planned);
  const actual = num(row.actual);
  return {
    id: row.id,
    period: row.period,
    planned,
    actual,
    notes: row.notes,
    variance: round2(planned - actual),
  };
}

function summarize(
  categories: BudgetCategory[],
  periods: BudgetPeriod[],
): BudgetSummary {
  const totalPlanned = round2(
    categories.reduce((sum, c) => sum + c.planned, 0),
  );
  const totalCommitted = round2(
    categories.reduce((sum, c) => sum + c.committed, 0),
  );
  const totalActual = round2(categories.reduce((sum, c) => sum + c.actual, 0));
  return {
    totalPlanned,
    totalCommitted,
    totalActual,
    totalVariance: round2(totalPlanned - totalCommitted),
    totalRemaining: round2(totalPlanned - totalActual),
    percentCommitted: pct(totalCommitted, totalPlanned),
    percentSpent: pct(totalActual, totalPlanned),
    categoryCount: categories.length,
    overBudgetCount: categories.filter((c) => c.committed > c.planned).length,
    periodPlanned: round2(periods.reduce((sum, p) => sum + p.planned, 0)),
    periodActual: round2(periods.reduce((sum, p) => sum + p.actual, 0)),
  };
}

function assertNonNegative(input: {
  planned?: number;
  committed?: number;
  actual?: number;
}): void {
  for (const value of [input.planned, input.committed, input.actual]) {
    if (value !== undefined && value < 0) {
      throw new BadRequestError("Budget amounts cannot be negative");
    }
  }
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function assertPeriod(period: string): void {
  if (!PERIOD_PATTERN.test(period)) {
    throw new BadRequestError("Period must be in YYYY-MM format");
  }
}

export function budgetService(repository: BudgetRepository) {
  return {
    async getByProject(projectId: string): Promise<ProjectBudget> {
      const [categoryRows, periodRows] = await Promise.all([
        repository.listCategories(projectId),
        repository.listPeriods(projectId),
      ]);
      const categories = categoryRows.map(toCategory);
      const periods = periodRows.map(toPeriod);
      return {
        projectId,
        categories,
        periods,
        summary: summarize(categories, periods),
      };
    },

    async createCategory(
      projectId: string,
      input: CreateCategoryInput,
    ): Promise<BudgetCategory> {
      assertNonNegative(input);
      const maxSort = await repository.maxCategorySortOrder(projectId);
      const row = await repository.createCategory({
        id: generateId("budgetcat"),
        project_id: projectId,
        name: input.name,
        cost_code: input.costCode ?? null,
        planned: String(input.planned ?? 0),
        committed: String(input.committed ?? 0),
        actual: String(input.actual ?? 0),
        notes: input.notes ?? null,
        sort_order: (maxSort ?? -1) + 1,
      });
      return toCategory(row);
    },

    async updateCategory(
      projectId: string,
      categoryId: string,
      input: UpdateCategoryInput,
    ): Promise<BudgetCategory> {
      assertNonNegative(input);
      const existing = await repository.findCategory(categoryId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Budget category");
      }
      const row = await repository.updateCategory(categoryId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.costCode !== undefined
          ? { cost_code: input.costCode || null }
          : {}),
        ...(input.planned !== undefined
          ? { planned: String(input.planned) }
          : {}),
        ...(input.committed !== undefined
          ? { committed: String(input.committed) }
          : {}),
        ...(input.actual !== undefined ? { actual: String(input.actual) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      });
      if (!row) throw new NotFoundError("Budget category");
      return toCategory(row);
    },

    async removeCategory(
      projectId: string,
      categoryId: string,
    ): Promise<void> {
      const existing = await repository.findCategory(categoryId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Budget category");
      }
      await repository.deleteCategory(categoryId);
    },

    async createPeriod(
      projectId: string,
      input: CreatePeriodInput,
    ): Promise<BudgetPeriod> {
      assertPeriod(input.period);
      assertNonNegative(input);
      const clash = await repository.findPeriodByValue(projectId, input.period);
      if (clash) {
        throw new BadRequestError(`Budget for ${input.period} already exists`);
      }
      const row = await repository.createPeriod({
        id: generateId("budgetperiod"),
        project_id: projectId,
        period: input.period,
        planned: String(input.planned ?? 0),
        actual: String(input.actual ?? 0),
        notes: input.notes ?? null,
      });
      return toPeriod(row);
    },

    async updatePeriod(
      projectId: string,
      periodId: string,
      input: UpdatePeriodInput,
    ): Promise<BudgetPeriod> {
      assertNonNegative(input);
      const existing = await repository.findPeriod(periodId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Budget period");
      }
      if (input.period !== undefined && input.period !== existing.period) {
        assertPeriod(input.period);
        const clash = await repository.findPeriodByValue(
          projectId,
          input.period,
        );
        if (clash) {
          throw new BadRequestError(`Budget for ${input.period} already exists`);
        }
      }
      const row = await repository.updatePeriod(periodId, {
        ...(input.period !== undefined ? { period: input.period } : {}),
        ...(input.planned !== undefined
          ? { planned: String(input.planned) }
          : {}),
        ...(input.actual !== undefined ? { actual: String(input.actual) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      });
      if (!row) throw new NotFoundError("Budget period");
      return toPeriod(row);
    },

    async removePeriod(projectId: string, periodId: string): Promise<void> {
      const existing = await repository.findPeriod(periodId);
      if (!existing || existing.project_id !== projectId) {
        throw new NotFoundError("Budget period");
      }
      await repository.deletePeriod(periodId);
    },
  };
}

export type BudgetService = ReturnType<typeof budgetService>;
