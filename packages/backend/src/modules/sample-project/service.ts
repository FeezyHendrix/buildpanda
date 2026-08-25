import { generateId } from "../../lib/ids.ts";
import { buildCoreSampleData } from "./data/core.ts";
import {
  buildFinanceSampleData,
  financeProjectPatch,
  financeSelectionDecisions,
} from "./data/finance.ts";
import type { SampleProjectRepository } from "./repository.ts";
import type { ProvisionResult, SampleProjectContext, SampleProjectDataset } from "./types.ts";

// The seed data predates the general document categories introduced by
// 20260629_general_document_categories, and category_id is a real foreign key —
// referencing a retired id fails the insert outright. Map the old ids onto their
// current equivalents; anything still unresolved falls back to null, which the
// column allows.
const CATEGORY_ALIASES: Record<string, string> = {
  "cat-land": "cat_doc_contracts",
  "cat-contracts": "cat_doc_contracts",
  "cat-invoices": "cat_doc_financial",
  "cat-approvals": "cat_doc_permits",
  "cat-inspections": "cat_doc_reports",
  "cat-architectural": "cat_plan_architectural",
};

// Insert order is a property of the schema, not of either builder, so it is
// declared once here. Every foreign key points strictly backwards in this list.
const INSERT_ORDER = [
  "projects",
  "buildings",
  "project_phases",
  "activities",
  "action_items",
  "action_item_comments",
  "queries",
  "query_comments",
  "approvals",
  "approval_comments",
  "change_requests",
  "change_request_comments",
  "permits",
  "key_dates",
  "project_participants",
  "project_documents",
  "project_updates",
  "update_media",
  "inspections",
  "inspection_media",
  "project_finances",
  "budget_phases",
  "project_budget_categories",
  "project_budget_periods",
  "material_orders",
  "material_procurements",
  "equipment_requests",
  "activity_delays",
  "daily_logs",
  "daily_log_activities",
  "milestone_payments",
  "payment_ledger",
  "suppliers",
  "cash_flow_entries",
  "materials_catalog",
  "materials_stock",
  "material_ledger_entries",
  "project_transactions",
  "project_invoices",
  "project_invoice_line_items",
  "invoice_payments",
  "purchase_orders",
  "purchase_order_items",
  "payment_claims",
  "task_boards",
  "task_columns",
  "tasks",
  "rfis",
  "project_selections",
  "project_selection_options",
  "risk_factors",
  "finance_events",
] as const;

function sortForInsert(dataset: SampleProjectDataset): SampleProjectDataset {
  const rank = new Map<string, number>(INSERT_ORDER.map((table, i) => [table, i]));
  for (const { table } of dataset) {
    if (!rank.has(table)) {
      throw new Error(`sample-project: "${table}" has no declared insert position`);
    }
  }
  return [...dataset].sort((a, b) => rank.get(a.table)! - rank.get(b.table)!);
}

export function sampleProjectContext(
  projectId: string,
  organizationId: string | null,
  ownerId: string | null,
): SampleProjectContext {
  return {
    projectId,
    buildingId: `bld_${projectId}`,
    sharedBuildingId: `bld_shared_${projectId}`,
    organizationId,
    ownerId,
    id: (suffix) => `${projectId}__${suffix}`,
  };
}

function prepare(
  dataset: SampleProjectDataset,
  available: Set<string>,
): SampleProjectDataset {
  return dataset.map((entry) => {
    // Drop is_sample and provisioning stops being idempotent: the column defaults
    // to false, so every sign-in would mint another sample project.
    if (entry.table === "projects") {
      return { table: entry.table, rows: entry.rows.map((row) => ({ ...row, is_sample: true })) };
    }
    if (entry.table !== "project_documents") return entry;
    return {
      table: entry.table,
      rows: entry.rows.map((row) => {
        const raw = row["category_id"];
        if (typeof raw !== "string") return row;
        const mapped = CATEGORY_ALIASES[raw] ?? raw;
        return { ...row, category_id: available.has(mapped) ? mapped : null };
      }),
    };
  });
}

export function sampleProjectService(repo: SampleProjectRepository) {
  return {
    /**
     * Gives a workspace its own copy of the sample project. Idempotent: a
     * workspace that already has one is left alone, so retries and repeat
     * sign-ins never produce duplicates.
     */
    async provisionFor(input: {
      organizationId: string;
      ownerId: string | null;
    }): Promise<ProvisionResult> {
      const existing = await repo.hasSampleProject(input.organizationId);
      if (existing) return { created: false, projectId: "" };

      const projectId = generateId("smp");
      const ctx = sampleProjectContext(projectId, input.organizationId, input.ownerId);

      const dataset = sortForInsert([...buildCoreSampleData(ctx), ...buildFinanceSampleData(ctx)]);
      const resolved = prepare(dataset, await repo.existingDocumentCategoryIds());

      await repo.insertDataset(resolved, {
        projectId,
        patch: financeProjectPatch(),
        deferred: financeSelectionDecisions(ctx),
      });

      return { created: true, projectId };
    },
  };
}

export type SampleProjectService = ReturnType<typeof sampleProjectService>;
