import type { Knex } from "knex";
import { ConflictError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  BudgetPhaseRow,
  CashFlowEntryRow,
  FinanceEventRow,
  FinancesRow,
  LedgerType,
  MaterialProcurementRow,
  MilestoneDisputeRow,
  MilestonePaymentRow,
  NewCashFlowEntryRecord,
  NewFinanceEventRecord,
  PaymentLedgerRow,
} from "./types.ts";

export interface NewDisputeRecord {
  id: string;
  milestone_id: string;
  raised_by_id: string;
  raised_by_name: string;
  reason: string;
}

export interface DepositOperation {
  projectId: string;
  amount: number;
  description: string;
  entryDate: string;
  ledgerId: string;
}

export interface ReleaseOperation {
  projectId: string;
  milestoneId: string;
  entryDate: string;
  description: string;
  ledgerId: string;
}

export interface NewMilestoneRecord {
  id: string;
  project_id: string;
  building_id?: string;
  name: string;
  phase: string;
  status: MilestonePaymentRow["status"];
  percent_complete: number;
  amount: string;
  proof_file_name: string | null;
  proof_verified: boolean;
  inspector_sign_off: MilestonePaymentRow["inspector_sign_off"];
  claim_state?: MilestonePaymentRow["claim_state"];
  sort_order: number;
}

export interface MilestoneUpdatePatch {
  name?: string;
  phase?: string;
  status?: MilestonePaymentRow["status"];
  percent_complete?: number;
  amount?: string;
  inspector_sign_off?: MilestonePaymentRow["inspector_sign_off"];
  claim_state?: MilestonePaymentRow["claim_state"];
}

export interface ClaimPaymentOperation {
  projectId: string;
  amount: number;
  entryId: string;
  description: string;
  entryDate: string;
  actor: { id: string; name: string } | null;
}

// Handoff links (schedule item → programme task → project phase) are added by
// another workstream; resolve through them only when every column exists.
async function linkedMilestoneIds(db: Knex, projectId: string, stageId: string): Promise<string[]> {
  try {
    const [hasScheduleItem, hasPhaseTask] = await Promise.all([
      db.schema.hasColumn("milestone_payments", "schedule_item_id"),
      db.schema.hasColumn("project_phases", "programme_task_id"),
    ]);
    if (!hasScheduleItem || !hasPhaseTask) return [];
    const hasScheduleTask = await db.schema.hasColumn("estimate_payment_schedule", "programme_task_id");
    if (!hasScheduleTask) return [];
    const rows = await db("milestone_payments as m")
      .join("estimate_payment_schedule as s", "s.id", "m.schedule_item_id")
      .join("project_phases as p", "p.programme_task_id", "s.programme_task_id")
      .where("m.project_id", projectId)
      .andWhere("p.id", stageId)
      .select<{ id: string }[]>("m.id");
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

export function financesRepository(db: Knex) {
  return {
    findSummary(projectId: string): Promise<FinancesRow | undefined> {
      return db<FinancesRow>("project_finances").where({ project_id: projectId }).first();
    },
    listBudgetPhases(projectId: string): Promise<BudgetPhaseRow[]> {
      return db<BudgetPhaseRow>("budget_phases")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },
    listMaterials(projectId: string): Promise<MaterialProcurementRow[]> {
      return db<MaterialProcurementRow>("material_procurements")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },
    listMilestones(projectId: string): Promise<MilestonePaymentRow[]> {
      return db<MilestonePaymentRow>("milestone_payments")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },
    listLedger(projectId: string): Promise<PaymentLedgerRow[]> {
      return db<PaymentLedgerRow>("payment_ledger")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },
    findMilestone(milestoneId: string): Promise<MilestonePaymentRow | undefined> {
      return db<MilestonePaymentRow>("milestone_payments").where({ id: milestoneId }).first();
    },

    async projectOwnerId(projectId: string): Promise<string | null> {
      const row = await db<{ owner_id: string | null }>("projects")
        .where({ id: projectId })
        .select("owner_id")
        .first();
      return row?.owner_id ?? null;
    },

    async createMilestone(record: Omit<NewMilestoneRecord, "sort_order">): Promise<MilestonePaymentRow> {
      const nextSortOrder =
        Number(
          (
            await db("milestone_payments")
              .where({ project_id: record.project_id })
              .max<{ max: number | null }>({ max: "sort_order" })
              .first()
          )?.max ?? -1,
        ) + 1;

      const buildingId = record.building_id ?? (await sharedBuildingId(db, record.project_id));
      const [row] = await db<MilestonePaymentRow>("milestone_payments")
        .insert({ ...record, building_id: buildingId, sort_order: nextSortOrder })
        .returning("*");
      if (!row) throw new Error("Failed to insert milestone");
      return row;
    },

    async updateMilestone(
      projectId: string,
      milestoneId: string,
      patch: MilestoneUpdatePatch,
    ): Promise<MilestonePaymentRow | undefined> {
      const [row] = await db<MilestonePaymentRow>("milestone_payments")
        .where({ project_id: projectId, id: milestoneId })
        .update(patch)
        .returning("*");
      return row;
    },

    // Milestones a stage unlocks. Prefer the handoff's schedule_item →
    // programme milestone → phase link when those columns exist; always include
    // the name match so milestones created by hand still bind to their stage.
    async listMilestonesForStage(projectId: string, stage: { id: string; name: string }): Promise<MilestonePaymentRow[]> {
      const rows = await db<MilestonePaymentRow>("milestone_payments").where({ project_id: projectId });
      const byName = rows.filter((row) => row.phase.trim().toLowerCase() === stage.name.trim().toLowerCase());
      const linked = await linkedMilestoneIds(db, projectId, stage.id);
      const ids = new Set([...byName.map((r) => r.id), ...linked]);
      return rows.filter((row) => ids.has(row.id));
    },

    async recordCertification(
      projectId: string,
      input: { certified: number; retention: number; advanceRecovery: number },
    ): Promise<void> {
      await db("project_finances")
        .where({ project_id: projectId })
        .update({
          certified_gross_to_date: db.raw("certified_gross_to_date + ?", [input.certified]),
          retention_held: db.raw("retention_held + ?", [input.retention]),
          advance_recovered: db.raw("advance_recovered + ?", [input.advanceRecovery]),
        });
    },

    async recordClaimPayment(operation: ClaimPaymentOperation): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("project_finances")
          .where({ project_id: operation.projectId })
          .update({ amount_paid_to_date: trx.raw("amount_paid_to_date + ?", [operation.amount]) });
        const count = await trx("cash_flow_entries")
          .where({ project_id: operation.projectId })
          .count<{ count: string }[]>("id as count");
        await trx("cash_flow_entries").insert({
          id: operation.entryId,
          project_id: operation.projectId,
          category: "claims_payment",
          amount: operation.amount,
          is_credit: true,
          description: operation.description,
          entry_date: operation.entryDate,
          created_by_id: operation.actor?.id ?? null,
          created_by_name: operation.actor?.name ?? null,
          sort_order: Number(count[0]?.count ?? 0),
        });
      });
    },

    async deleteMilestone(projectId: string, milestoneId: string): Promise<number> {
      return db<MilestonePaymentRow>("milestone_payments")
        .where({ project_id: projectId, id: milestoneId })
        .delete();
    },

    listDisputesForMilestone(milestoneId: string): Promise<MilestoneDisputeRow[]> {
      return db<MilestoneDisputeRow>("milestone_disputes")
        .where({ milestone_id: milestoneId })
        .orderBy("created_at", "desc");
    },

    async createDispute(record: NewDisputeRecord): Promise<MilestoneDisputeRow> {
      const [row] = await db<MilestoneDisputeRow>("milestone_disputes")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert milestone dispute");
      return row;
    },

    deposit(operation: DepositOperation): Promise<void> {
      return db.transaction(async (trx) => {
        const summary = await trx<FinancesRow>("project_finances")
          .where({ project_id: operation.projectId })
          .forUpdate()
          .first();
        if (!summary) throw new ConflictError("Project finances not initialized");

        await trx("project_finances")
          .where({ project_id: operation.projectId })
          .update({
            amount_paid_to_date: trx.raw("amount_paid_to_date + ?", [operation.amount]),
          });

        await appendLedger(trx, {
          ledgerId: operation.ledgerId,
          projectId: operation.projectId,
          entryDate: operation.entryDate,
          description: operation.description,
          amount: operation.amount,
          type: "Deposit",
        });
      });
    },

    releaseMilestone(operation: ReleaseOperation): Promise<MilestonePaymentRow> {
      return db.transaction(async (trx) => {
        const milestone = await trx<MilestonePaymentRow>("milestone_payments")
          .where({ id: operation.milestoneId, project_id: operation.projectId })
          .forUpdate()
          .first();
        if (!milestone) {
          throw new ConflictError("Milestone not found for this project");
        }
        if (milestone.status === "Completed") {
          throw new ConflictError("Milestone is already completed");
        }
        if (!milestone.proof_verified || !milestone.proof_file_name) {
          throw new ConflictError("Milestone proof is not verified");
        }

        const amount = Number(milestone.amount);

        await trx("milestone_payments")
          .where({ id: operation.milestoneId })
          .update({ status: "Completed", percent_complete: 100 });

        await trx("project_finances")
          .where({ project_id: operation.projectId })
          .update({
            certified_gross_to_date: trx.raw("certified_gross_to_date + ?", [amount]),
            amount_paid_to_date: trx.raw("amount_paid_to_date + ?", [amount]),
          });

        await appendLedger(trx, {
          ledgerId: operation.ledgerId,
          projectId: operation.projectId,
          entryDate: operation.entryDate,
          description: operation.description,
          amount,
          type: "Release",
        });

        const updated = await trx<MilestonePaymentRow>("milestone_payments")
          .where({ id: operation.milestoneId })
          .first();
        if (!updated) throw new ConflictError("Milestone disappeared after update");
        return updated;
      });
    },

    async updateContractSum(projectId: string, contractSum: number): Promise<void> {
      await db("project_finances")
        .where({ project_id: projectId })
        .update({ contract_sum: contractSum });
    },

    async updateContractTerms(
      projectId: string,
      patch: Partial<{
        contract_type: string;
        retention_rate: number;
        retention_release_mode: string;
        advance_percentage: number;
        advance_recovery_mode: string;
        advance_recovery_rate: number;
        payment_terms_days: number;
        defects_liability_days: number;
        contract_notes: string | null;
      }>,
    ): Promise<void> {
      if (Object.keys(patch).length === 0) return;
      await db("project_finances")
        .where({ project_id: projectId })
        .update(patch);
    },

    async recordVariation(
      projectId: string,
      amount: number,
    ): Promise<void> {
      await db("project_finances")
        .where({ project_id: projectId })
        .update({
          variations_total: db.raw("variations_total + ?", [amount]),
        });
    },

    listCashFlowEntries(projectId: string): Promise<CashFlowEntryRow[]> {
      return db<CashFlowEntryRow>("cash_flow_entries")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc");
    },

    async insertCashFlowEntry(record: NewCashFlowEntryRecord): Promise<void> {
      await db("cash_flow_entries").insert(record);
    },

    async findRetentionRate(projectId: string): Promise<number> {
      const row = await db<{ retention_rate: string | null }>("project_finances")
        .where({ project_id: projectId })
        .select("retention_rate")
        .first();
      const raw = row?.retention_rate;
      return raw ? Number(raw) : 0;
    },

    async accrueRetention(projectId: string, amount: number): Promise<void> {
      await db("project_finances")
        .where({ project_id: projectId })
        .update({
          retention_held: db.raw("retention_held + ?", [amount]),
        });
    },

    async updateCertifiedGrossToDate(projectId: string, amount: number): Promise<void> {
      await db("project_finances")
        .where({ project_id: projectId })
        .update({
          certified_gross_to_date: db.raw("certified_gross_to_date + ?", [amount]),
        });
    },

    listEvents(projectId: string, limit = 100): Promise<FinanceEventRow[]> {
      return db<FinanceEventRow>("finance_events")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(limit);
    },

    async insertEvent(record: NewFinanceEventRecord): Promise<void> {
      await db("finance_events").insert({
        id: generateId("finev"),
        project_id: record.project_id,
        type: record.type,
        actor_id: record.actor_id,
        actor_name: record.actor_name,
        summary: record.summary,
        amount: record.amount ?? null,
        entity_id: record.entity_id ?? null,
      });
    },
  };
}

interface LedgerAppend {
  ledgerId: string;
  projectId: string;
  buildingId?: string;
  entryDate: string;
  description: string;
  amount: number;
  type: LedgerType;
}

async function sharedBuildingId(db: Knex, projectId: string): Promise<string> {
  const row = await db("buildings")
    .where({ project_id: projectId, kind: "shared" })
    .select("id")
    .first();
  if (!row) throw new Error(`No shared building for project ${projectId}`);
  return row.id;
}

async function appendLedger(trx: Knex.Transaction, entry: LedgerAppend): Promise<void> {
  const nextSortOrder =
    Number(
      (
        await trx("payment_ledger")
          .where({ project_id: entry.projectId })
          .max<{ max: number | null }>({ max: "sort_order" })
          .first()
      )?.max ?? -1,
    ) + 1;

  await trx("payment_ledger").insert({
    id: entry.ledgerId,
    project_id: entry.projectId,
    building_id: entry.buildingId ?? (await sharedBuildingId(trx, entry.projectId)),
    entry_date: entry.entryDate,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    sort_order: nextSortOrder,
  });
}

export type FinancesRepository = ReturnType<typeof financesRepository>;
