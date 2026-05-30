import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { FinancesRepository } from "./repository.ts";
import type {
  BudgetPhase,
  BudgetPhaseRow,
  FinancesRow,
  MaterialProcurement,
  MaterialProcurementRow,
  MilestoneDispute,
  MilestoneDisputeRow,
  MilestonePayment,
  MilestonePaymentRow,
  PaymentLedgerEntry,
  PaymentLedgerRow,
  ProjectFinances,
} from "./types.ts";

export interface DepositInput {
  amount: number;
  description?: string;
  entryDate?: string;
}

export interface RaiseDisputeInput {
  reason: string;
}

function toDispute(row: MilestoneDisputeRow): MilestoneDispute {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    raisedBy: { id: row.raised_by_id, name: row.raised_by_name },
    reason: row.reason,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };
}

function num(value: string): number {
  return Number(value);
}

function toBudgetPhase(row: BudgetPhaseRow): BudgetPhase {
  return {
    id: row.id,
    name: row.name,
    planned: num(row.planned),
    actual: num(row.actual),
  };
}

function toMaterial(row: MaterialProcurementRow): MaterialProcurement {
  return {
    id: row.id,
    name: row.name,
    purchasedAt: row.purchased_at,
    receipt: row.receipt,
    amount: num(row.amount),
    thumbnailTone: row.thumbnail_tone,
  };
}

function toMilestone(row: MilestonePaymentRow): MilestonePayment {
  return {
    id: row.id,
    name: row.name,
    phase: row.phase,
    status: row.status,
    percentComplete: row.percent_complete,
    amount: num(row.amount),
    proof: row.proof_file_name
      ? { fileName: row.proof_file_name, verified: row.proof_verified }
      : null,
    inspectorSignOff: row.inspector_sign_off,
  };
}

function toLedgerEntry(row: PaymentLedgerRow): PaymentLedgerEntry {
  return {
    id: row.id,
    date: row.entry_date,
    description: row.description,
    amount: num(row.amount),
    type: row.type,
  };
}

function toFinances(
  summary: FinancesRow,
  budgetPhases: BudgetPhaseRow[],
  materials: MaterialProcurementRow[],
  milestones: MilestonePaymentRow[],
  ledger: PaymentLedgerRow[],
): ProjectFinances {
  return {
    projectId: summary.project_id,
    currency: summary.currency,
    totalBudget: num(summary.total_budget),
    fundsDeposited: num(summary.funds_deposited),
    fundsReleased: num(summary.funds_released),
    lockedInEscrow: num(summary.locked_in_escrow),
    remainingBalance: num(summary.remaining_balance),
    budgetAllocation: budgetPhases.map(toBudgetPhase),
    materialsProcured: materials.map(toMaterial),
    milestones: milestones.map(toMilestone),
    ledger: ledger.map(toLedgerEntry),
  };
}

export function financesService(repository: FinancesRepository) {
  return {
    async getByProject(projectId: string): Promise<ProjectFinances> {
      const [summary, budgetPhases, materials, milestones, ledger] = await Promise.all([
        repository.findSummary(projectId),
        repository.listBudgetPhases(projectId),
        repository.listMaterials(projectId),
        repository.listMilestones(projectId),
        repository.listLedger(projectId),
      ]);

      if (!summary) throw new NotFoundError("Project finances");

      return toFinances(summary, budgetPhases, materials, milestones, ledger);
    },

    async deposit(projectId: string, input: DepositInput): Promise<ProjectFinances> {
      if (input.amount <= 0) {
        throw new BadRequestError("Deposit amount must be positive");
      }
      await repository.deposit({
        projectId,
        amount: input.amount,
        description: input.description ?? "Deposit · Project funding",
        entryDate: input.entryDate ?? new Date().toISOString().slice(0, 10),
        ledgerId: generateId("ledger"),
      });
      return this.getByProject(projectId);
    },

    async releaseMilestone(
      projectId: string,
      milestoneId: string,
    ): Promise<MilestonePayment> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone) throw new NotFoundError("Milestone");
      if (milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const updated = await repository.releaseMilestone({
        projectId,
        milestoneId,
        entryDate: new Date().toISOString().slice(0, 10),
        description: `Release · ${milestone.name}`,
        ledgerId: generateId("ledger"),
      });
      return toMilestone(updated);
    },

    async listDisputes(
      projectId: string,
      milestoneId: string,
    ): Promise<MilestoneDispute[]> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone || milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const rows = await repository.listDisputesForMilestone(milestoneId);
      return rows.map(toDispute);
    },

    async raiseDispute(
      projectId: string,
      milestoneId: string,
      input: RaiseDisputeInput,
      actor: { id: string; name: string },
    ): Promise<MilestoneDispute> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone || milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const row = await repository.createDispute({
        id: generateId("dispute"),
        milestone_id: milestoneId,
        raised_by_id: actor.id,
        raised_by_name: actor.name,
        reason: input.reason,
      });
      return toDispute(row);
    },
  };
}

export type FinancesService = ReturnType<typeof financesService>;
