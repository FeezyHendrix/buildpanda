import type { Knex } from "knex";
import { ConflictError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  BudgetPhaseRow,
  FinanceEventRow,
  FinancesRow,
  LedgerType,
  MaterialProcurementRow,
  MilestoneDisputeRow,
  MilestonePaymentRow,
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
  name: string;
  phase: string;
  status: MilestonePaymentRow["status"];
  percent_complete: number;
  amount: string;
  proof_file_name: string | null;
  proof_verified: boolean;
  inspector_sign_off: MilestonePaymentRow["inspector_sign_off"];
  sort_order: number;
}

export interface MilestoneUpdatePatch {
  name?: string;
  phase?: string;
  status?: MilestonePaymentRow["status"];
  percent_complete?: number;
  amount?: string;
  inspector_sign_off?: MilestonePaymentRow["inspector_sign_off"];
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

      const [row] = await db<MilestonePaymentRow>("milestone_payments")
        .insert({ ...record, sort_order: nextSortOrder })
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
            funds_deposited: trx.raw("funds_deposited + ?", [operation.amount]),
            locked_in_escrow: trx.raw("locked_in_escrow + ?", [operation.amount]),
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

        const summary = await trx<FinancesRow>("project_finances")
          .where({ project_id: operation.projectId })
          .forUpdate()
          .first();
        if (!summary) throw new ConflictError("Project finances not initialized");
        if (Number(summary.locked_in_escrow) < amount) {
          throw new ConflictError("Insufficient escrow balance to release milestone");
        }

        await trx("milestone_payments")
          .where({ id: operation.milestoneId })
          .update({ status: "Completed", percent_complete: 100 });

        await trx("project_finances")
          .where({ project_id: operation.projectId })
          .update({
            funds_released: trx.raw("funds_released + ?", [amount]),
            locked_in_escrow: trx.raw("locked_in_escrow - ?", [amount]),
            remaining_balance: trx.raw("total_budget - (funds_released + ?)", [
              amount,
            ]),
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
  entryDate: string;
  description: string;
  amount: number;
  type: LedgerType;
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
    entry_date: entry.entryDate,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    sort_order: nextSortOrder,
  });
}

export type FinancesRepository = ReturnType<typeof financesRepository>;
