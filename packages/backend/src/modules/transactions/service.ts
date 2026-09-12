import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import {
  asIsoDate,
  categoryDisplay,
  csvEscape,
  isPresetKey,
  toCustomCategory,
  toTransaction,
  trim,
} from "./mappers.ts";
import type {
  CustomCategoriesRepository,
  TransactionsRepository,
} from "./repository.ts";
import {
  PRESET_TRANSACTION_CATEGORIES,
  type CategoryType,
  type CreateCustomCategoryInput,
  type CreateTransactionInput,
  type CustomCategoryRow,
  type EditTransactionInput,
  type Transaction,
  type TransactionAnalytics,
  type TransactionAnalyticsByCategory,
  type TransactionCategoryInfo,
  type TransactionListFilters,
  type TransactionRow,
  type TransactionRowWithUser,
} from "./types.ts";

// Request-body shapes live in types.ts; re-exported so existing importers keep working.
export type { CreateCustomCategoryInput, CreateTransactionInput, EditTransactionInput };

export interface TransactionsDeps {
  // Wired by the route plugin from the stages module so this service never
  // touches project_phases directly.
  stageBelongsToProject?: (projectId: string, stageId: string) => Promise<boolean>;
}

export function transactionsService(
  transactions: TransactionsRepository,
  customCategories: CustomCategoriesRepository,
  deps: TransactionsDeps = {},
) {
  async function resolveStageId(
    projectId: string,
    stageId: string | null | undefined,
  ): Promise<string | null> {
    const trimmed = trim(stageId);
    if (!trimmed) return null;
    if (deps.stageBelongsToProject && !(await deps.stageBelongsToProject(projectId, trimmed))) {
      throw new BadRequestError("Stage does not belong to this project");
    }
    return trimmed;
  }

  async function customIndexFor(orgId: string): Promise<Map<string, CustomCategoryRow>> {
    const rows = await customCategories.listByOrg(orgId);
    const map = new Map<string, CustomCategoryRow>();
    for (const row of rows) map.set(row.label.toLowerCase(), row);
    return map;
  }

  async function resolveCategory(
    orgId: string,
    category: string,
  ): Promise<{ category: string; type: CategoryType }> {
    const trimmed = category.trim();
    if (trimmed.length === 0) {
      throw new BadRequestError("Category is required");
    }
    if (isPresetKey(trimmed)) {
      return { category: trimmed, type: "preset" };
    }
    const custom = await customCategories.findByLabel(orgId, trimmed);
    if (!custom) {
      throw new BadRequestError(`Unknown category: ${trimmed}`);
    }
    return { category: custom.label, type: "custom" };
  }

  async function getOwned(
    projectId: string,
    transactionId: string,
  ): Promise<TransactionRowWithUser> {
    const existing = await transactions.findById(transactionId);
    if (!existing || existing.project_id !== projectId) {
      throw new NotFoundError("Transaction");
    }
    return existing;
  }

  function ensureAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestError("Amount must be a non-negative number");
    }
  }

  return {
    async list(
      projectId: string,
      orgId: string,
      filters?: TransactionListFilters,
    ): Promise<Transaction[]> {
      const [rows, customIndex] = await Promise.all([
        transactions.listByProject(projectId, filters),
        customIndexFor(orgId),
      ]);
      return rows.map((row) => toTransaction(row, customIndex));
    },

    async get(
      projectId: string,
      orgId: string,
      transactionId: string,
    ): Promise<Transaction> {
      const [row, customIndex] = await Promise.all([
        getOwned(projectId, transactionId),
        customIndexFor(orgId),
      ]);
      return toTransaction(row, customIndex);
    },

    async create(
      projectId: string,
      orgId: string,
      userId: string,
      input: CreateTransactionInput,
    ): Promise<Transaction> {
      ensureAmount(input.amount);
      const resolved = await resolveCategory(orgId, input.category);
      const title = input.title.trim();
      if (title.length === 0) {
        throw new BadRequestError("Title is required");
      }
      const row = await transactions.create({
        id: generateId("txn"),
        project_id: projectId,
        title,
        description: trim(input.description),
        category: resolved.category,
        category_type: resolved.type,
        amount: input.amount.toFixed(2),
        transacted_at: asIsoDate(input.transactedAt),
        vendor: trim(input.vendor),
        reference: trim(input.reference),
        receipt_file_id: trim(input.receiptFileId),
        stage_id: await resolveStageId(projectId, input.stageId),
        created_by_id: userId,
      });
      const enriched = (await transactions.findById(row.id)) ?? {
        ...(row as TransactionRow),
        created_by_name: null,
        stage_name: null,
      };
      const customIndex = await customIndexFor(orgId);
      return toTransaction(enriched, customIndex);
    },

    async edit(
      projectId: string,
      orgId: string,
      transactionId: string,
      input: EditTransactionInput,
    ): Promise<Transaction> {
      await getOwned(projectId, transactionId);

      const patch: Parameters<typeof transactions.update>[1] = {};
      if (input.title !== undefined) {
        const title = input.title.trim();
        if (title.length === 0) throw new BadRequestError("Title cannot be empty");
        patch.title = title;
      }
      if (input.description !== undefined) patch.description = trim(input.description);
      if (input.category !== undefined) {
        const resolved = await resolveCategory(orgId, input.category);
        patch.category = resolved.category;
        patch.category_type = resolved.type;
      }
      if (input.amount !== undefined) {
        ensureAmount(input.amount);
        patch.amount = input.amount.toFixed(2);
      }
      if (input.transactedAt !== undefined) {
        patch.transacted_at = asIsoDate(input.transactedAt);
      }
      if (input.vendor !== undefined) patch.vendor = trim(input.vendor);
      if (input.reference !== undefined) patch.reference = trim(input.reference);
      if (input.receiptFileId !== undefined) {
        patch.receipt_file_id = trim(input.receiptFileId);
      }
      if (input.stageId !== undefined) patch.stage_id = await resolveStageId(projectId, input.stageId);

      const updated = await transactions.update(transactionId, patch);
      if (!updated) throw new NotFoundError("Transaction");

      const enriched =
        (await transactions.findById(updated.id)) ?? {
          ...(updated as TransactionRow),
          created_by_name: null,
          stage_name: null,
        };
      const customIndex = await customIndexFor(orgId);
      return toTransaction(enriched, customIndex);
    },

    async remove(projectId: string, transactionId: string): Promise<void> {
      await getOwned(projectId, transactionId);
      await transactions.remove(transactionId);
    },

    async analytics(
      projectId: string,
      orgId: string,
      filters?: TransactionListFilters,
    ): Promise<TransactionAnalytics> {
      const [byCategory, byMonth, totals, customIndex] = await Promise.all([
        transactions.aggregateByCategory(projectId, filters),
        transactions.aggregateByMonth(projectId, filters),
        transactions.totals(projectId, filters),
        customIndexFor(orgId),
      ]);

      const categoryBreakdown: TransactionAnalyticsByCategory[] = byCategory.map(
        ({ category, total, count }) => {
          const type: CategoryType = isPresetKey(category) ? "preset" : "custom";
          const display = categoryDisplay(category, type, customIndex);
          return {
            key: category,
            label: display.label,
            color: display.color,
            type,
            total: Number(total),
            count: Number(count),
          };
        },
      );

      categoryBreakdown.sort((a, b) => b.total - a.total);

      return {
        totalAmount: totals.total ? Number(totals.total) : 0,
        count: Number(totals.count),
        byCategory: categoryBreakdown,
        byMonth: byMonth.map(({ month, total }) => ({
          month,
          total: Number(total),
        })),
      };
    },

    async listCategories(orgId: string): Promise<TransactionCategoryInfo[]> {
      const custom = await customCategories.listByOrg(orgId);
      const presetInfos: TransactionCategoryInfo[] = PRESET_TRANSACTION_CATEGORIES.map(
        (c) => ({
          key: c.key,
          label: c.label,
          color: c.color,
          type: "preset",
          categoryId: null,
        }),
      );
      const customInfos: TransactionCategoryInfo[] = custom.map((c) => ({
        key: c.label,
        label: c.label,
        color: c.color,
        type: "custom",
        categoryId: c.id,
      }));
      return [...presetInfos, ...customInfos];
    },

    async createCategory(
      orgId: string,
      userId: string,
      input: CreateCustomCategoryInput,
    ): Promise<TransactionCategoryInfo> {
      const label = input.label.trim();
      if (label.length === 0) {
        throw new BadRequestError("Label is required");
      }
      if (isPresetKey(label.toLowerCase().replace(/\s+/g, "_"))) {
        throw new ConflictError("A preset category with that name already exists");
      }
      const existing = await customCategories.findByLabel(orgId, label);
      if (existing) {
        throw new ConflictError("A category with that label already exists");
      }
      const color = trim(input.color);
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new BadRequestError("Color must be a hex string like #RRGGBB");
      }
      const row = await customCategories.create({
        id: generateId("tcat"),
        org_id: orgId,
        label,
        color,
        created_by_id: userId,
      });
      const dto = toCustomCategory(row);
      return {
        key: dto.label,
        label: dto.label,
        color: dto.color,
        type: "custom",
        categoryId: dto.id,
      };
    },

    async removeCategory(orgId: string, categoryId: string): Promise<void> {
      const existing = await customCategories.findById(categoryId);
      if (!existing || existing.org_id !== orgId) {
        throw new NotFoundError("Category");
      }
      await customCategories.remove(categoryId);
    },

    async exportCsv(
      projectId: string,
      orgId: string,
      filters?: TransactionListFilters,
    ): Promise<string> {
      const rows = await this.list(projectId, orgId, filters);
      const header = [
        "Date",
        "Title",
        "Category",
        "Stage",
        "Amount",
        "Vendor",
        "Reference",
        "Description",
        "Logged By",
        "Logged At",
      ];
      const body = rows.map((r) =>
        [
          r.transactedAt,
          r.title,
          r.categoryLabel,
          r.stageName ?? "",
          r.amount.toFixed(2),
          r.vendor ?? "",
          r.reference ?? "",
          r.description ?? "",
          r.createdByName ?? "",
          r.createdAt,
        ]
          .map(csvEscape)
          .join(","),
      );
      return [header.map(csvEscape).join(","), ...body].join("\n");
    },
  };
}

export type TransactionsService = ReturnType<typeof transactionsService>;
