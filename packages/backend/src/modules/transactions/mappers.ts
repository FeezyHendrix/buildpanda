import { BadRequestError } from "../../lib/errors.ts";
import {
  PRESET_CATEGORY_KEYS,
  PRESET_TRANSACTION_CATEGORIES,
  type CategoryType,
  type CustomCategoryRow,
  type CustomTransactionCategory,
  type Transaction,
  type TransactionRowWithUser,
} from "./types.ts";

// Pure row -> DTO mapping and value normalisation for the transactions
// service. No I/O lives here.

const PRESET_MAP = new Map<string, { label: string; color: string }>(
  PRESET_TRANSACTION_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }]),
);

export function isPresetKey(key: string): boolean {
  return PRESET_CATEGORY_KEYS.includes(key as (typeof PRESET_CATEGORY_KEYS)[number]);
}

export function trim(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function asIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("Invalid date");
  }
  return parsed.toISOString().slice(0, 10);
}

function asIsoDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function asIsoDay(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.length >= 10 ? value.slice(0, 10) : value;
}

export function categoryDisplay(
  category: string,
  categoryType: CategoryType,
  customIndex: Map<string, CustomCategoryRow>,
): { label: string; color: string | null } {
  if (categoryType === "preset") {
    const preset = PRESET_MAP.get(category);
    return preset
      ? { label: preset.label, color: preset.color }
      : { label: category, color: null };
  }
  const custom = customIndex.get(category.toLowerCase());
  return custom
    ? { label: custom.label, color: custom.color }
    : { label: category, color: null };
}

export function toTransaction(
  row: TransactionRowWithUser,
  customIndex: Map<string, CustomCategoryRow>,
): Transaction {
  const display = categoryDisplay(row.category, row.category_type, customIndex);
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: display.label,
    categoryColor: display.color,
    categoryType: row.category_type,
    amount: Number(row.amount),
    transactedAt: asIsoDay(row.transacted_at),
    vendor: row.vendor,
    reference: row.reference,
    receiptFileId: row.receipt_file_id,
    stageId: row.stage_id ?? null,
    stageName: row.stage_name ?? null,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: asIsoDateTime(row.created_at),
    updatedAt: asIsoDateTime(row.updated_at),
  };
}

export function toCustomCategory(row: CustomCategoryRow): CustomTransactionCategory {
  return {
    id: row.id,
    orgId: row.org_id,
    label: row.label,
    color: row.color,
    createdAt: asIsoDateTime(row.created_at),
  };
}

export function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
