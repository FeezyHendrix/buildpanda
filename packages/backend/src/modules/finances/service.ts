import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { FinancesRepository } from "./repository.ts";
import type {
  BudgetPhase,
  BudgetPhaseRow,
  CashFlowCategory,
  CashFlowEntry,
  CashFlowEntryRow,
  FinanceEvent,
  FinanceEventRow,
  FinanceEventType,
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

export interface FinanceActor {
  id: string;
  name: string;
}

export interface DepositInput {
  amount: number;
  description?: string;
  entryDate?: string;
}

export interface RaiseDisputeInput {
  reason: string;
}

export interface UpdateContractSumInput {
  contractSum: number;
}

export interface RecordVariationInput {
  amount: number;
  description: string;
}

export interface CashFlowInput {
  category: CashFlowCategory;
  amount: number;
  isCredit: boolean;
  description?: string;
  entryDate?: string;
}

export interface CreateMilestoneInput {
  name: string;
  phase: string;
  amount: number;
  percentComplete?: number;
  status?: "Completed" | "InProgress" | "Pending";
  inspectorSignOff?: "Verified" | "Scheduled" | "Pending";
}

export interface UpdateMilestoneInput {
  name?: string;
  phase?: string;
  amount?: number;
  percentComplete?: number;
  status?: "Completed" | "InProgress" | "Pending";
  inspectorSignOff?: "Verified" | "Scheduled" | "Pending";
}

export interface FinancesDeps {
  notifications?: NotificationsService;
}

function notifyMilestoneReleased(
  deps: FinancesDeps,
  recipientId: string | null | undefined,
  projectId: string,
  name: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "milestone_released", {
      title: "Milestone payment released",
      body: name,
      projectId,
    })
    .catch(() => undefined);
}

function notifyMilestoneDisputed(
  deps: FinancesDeps,
  recipientId: string | null | undefined,
  projectId: string,
  name: string,
  reason: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "milestone_disputed", {
      title: "Milestone payment disputed",
      body: `${name}: ${reason}`,
      projectId,
    })
    .catch(() => undefined);
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
    descriptionHtml: row.description_html,
    amount: num(row.amount),
    type: row.type,
  };
}

function toCashFlowEntry(row: CashFlowEntryRow): CashFlowEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category,
    amount: num(row.amount),
    isCredit: row.is_credit,
    description: row.description,
    entryDate: row.entry_date,
    createdBy: row.created_by_id
      ? { id: row.created_by_id, name: row.created_by_name ?? "" }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    retentionAccrued: num(row.retention_accrued),
  };
}

function toEvent(row: FinanceEventRow): FinanceEvent {
  return {
    id: row.id,
    type: row.type,
    actor: { id: row.actor_id, name: row.actor_name },
    summary: row.summary,
    amount: row.amount === null ? null : num(row.amount),
    entityId: row.entity_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toFinances(
  summary: FinancesRow,
  budgetPhases: BudgetPhaseRow[],
  materials: MaterialProcurementRow[],
  milestones: MilestonePaymentRow[],
  ledger: PaymentLedgerRow[],
): ProjectFinances {
  const contractSum = num(summary.contract_sum);
  const variationsTotal = num(summary.variations_total);
  return {
    projectId: summary.project_id,
    currency: summary.currency,
    totalBudget: num(summary.total_budget),
    contractSum,
    variationsTotal,
    adjustedContract: contractSum + variationsTotal,
    certifiedGrossToDate: num(summary.certified_gross_to_date),
    amountPaidToDate: num(summary.amount_paid_to_date),
    budgetAllocation: budgetPhases.map(toBudgetPhase),
    materialsProcured: materials.map(toMaterial),
    milestones: milestones.map(toMilestone),
    ledger: ledger.map(toLedgerEntry),
  };
}

export function financesService(repository: FinancesRepository, deps: FinancesDeps = {}) {
  // Best-effort audit trail: a logging failure must never break the finance
  // action that triggered it, so the insert is awaited-and-swallowed.
  async function recordEvent(
    projectId: string,
    type: FinanceEventType,
    actor: FinanceActor | null,
    summary: string,
    amount?: number | null,
    entityId?: string | null,
  ): Promise<void> {
    try {
      await repository.insertEvent({
        project_id: projectId,
        type,
        actor_id: actor?.id ?? null,
        actor_name: actor?.name ?? "System",
        summary,
        amount: amount ?? null,
        entity_id: entityId ?? null,
      });
    } catch {
      void 0;
    }
  }

  return {
    async listEvents(projectId: string): Promise<FinanceEvent[]> {
      const rows = await repository.listEvents(projectId);
      return rows.map(toEvent);
    },

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

    async listCashFlowEntries(projectId: string): Promise<CashFlowEntry[]> {
      const rows = await repository.listCashFlowEntries(projectId);
      return rows.map(toCashFlowEntry);
    },

    async addCashFlowEntry(
      projectId: string,
      input: CashFlowInput,
      actor?: FinanceActor,
    ): Promise<CashFlowEntry> {
      if (input.amount <= 0) {
        throw new BadRequestError("Cash flow amount must be positive");
      }

      const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);
      const nextSortOrder =
        (
          await repository.listCashFlowEntries(projectId)
        ).length;

      let retentionAccrued = 0;
      if (input.category === "valuation") {
        const rate = await repository.findRetentionRate(projectId);
        if (rate > 0) {
          retentionAccrued = Math.round((input.amount * rate) / 100);
          await repository.accrueRetention(projectId, retentionAccrued);
        }
      }

      const id = generateId("cfe");
      await repository.insertCashFlowEntry({
        id,
        project_id: projectId,
        category: input.category,
        amount: input.amount,
        is_credit: input.isCredit,
        description: input.description ?? null,
        entry_date: entryDate,
        created_by_id: actor?.id ?? null,
        created_by_name: actor?.name ?? null,
        sort_order: nextSortOrder,
        retention_accrued: retentionAccrued,
      });

      if (input.category === "valuation") {
        await repository.updateCertifiedGrossToDate(projectId, input.amount);
      }

      const catLabel =
        input.category === "valuation"
          ? "Valuation"
          : input.category === "claims_payment"
            ? input.isCredit ? "Claims credit" : "Claims payment"
            : "Milestone payment";
      await recordEvent(
        projectId,
        "cash_flow_entry",
        actor ?? null,
        `${catLabel} · ${input.description ?? entryDate}${retentionAccrued > 0 ? ` (retention: ${retentionAccrued})` : ""}`,
        input.isCredit ? -input.amount : input.amount,
      );

      const row = (await repository.listCashFlowEntries(projectId))
        .find((r) => r.id === id);
      if (!row) throw new Error("Failed to read back cash flow entry");
      return toCashFlowEntry(row);
    },

    async deposit(projectId: string, input: DepositInput, actor?: FinanceActor): Promise<ProjectFinances> {
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
      await recordEvent(projectId, "deposit", actor ?? null, "Funded project", input.amount);
      return this.getByProject(projectId);
    },

    async createMilestone(
      projectId: string,
      input: CreateMilestoneInput,
      actor?: FinanceActor,
    ): Promise<MilestonePayment> {
      if (input.amount < 0) throw new BadRequestError("Milestone amount cannot be negative");
      const row = await repository.createMilestone({
        id: generateId("milestone"),
        project_id: projectId,
        name: input.name,
        phase: input.phase,
        status: input.status ?? "Pending",
        percent_complete: input.percentComplete ?? 0,
        amount: String(input.amount),
        proof_file_name: null,
        proof_verified: false,
        inspector_sign_off: input.inspectorSignOff ?? "Pending",
      });
      await recordEvent(projectId, "milestone_created", actor ?? null, `Added milestone · ${row.name}`, input.amount, row.id);
      return toMilestone(row);
    },

    async updateMilestone(
      projectId: string,
      milestoneId: string,
      input: UpdateMilestoneInput,
      actor?: FinanceActor,
    ): Promise<MilestonePayment> {
      if (input.amount !== undefined && input.amount < 0) {
        throw new BadRequestError("Milestone amount cannot be negative");
      }
      const row = await repository.updateMilestone(projectId, milestoneId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phase !== undefined ? { phase: input.phase } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.percentComplete !== undefined
          ? { percent_complete: input.percentComplete }
          : {}),
        ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
        ...(input.inspectorSignOff !== undefined
          ? { inspector_sign_off: input.inspectorSignOff }
          : {}),
      });
      if (!row) throw new NotFoundError("Milestone");
      await recordEvent(projectId, "milestone_updated", actor ?? null, `Updated milestone · ${row.name}`, num(row.amount), row.id);
      return toMilestone(row);
    },

    async deleteMilestone(projectId: string, milestoneId: string, actor?: FinanceActor): Promise<void> {
      const existing = await repository.findMilestone(milestoneId);
      const deleted = await repository.deleteMilestone(projectId, milestoneId);
      if (deleted === 0) throw new NotFoundError("Milestone");
      await recordEvent(
        projectId,
        "milestone_deleted",
        actor ?? null,
        `Removed milestone · ${existing?.name ?? milestoneId}`,
        existing ? num(existing.amount) : null,
        milestoneId,
      );
    },

    async releaseMilestone(
      projectId: string,
      milestoneId: string,
      actor: FinanceActor,
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
      const projectOwnerId = await repository.projectOwnerId(projectId);
      notifyMilestoneReleased(deps, projectOwnerId, projectId, updated.name, actor.id);
      await recordEvent(projectId, "milestone_released", actor, `Released milestone from escrow · ${updated.name}`, num(updated.amount), milestoneId);
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
      const projectOwnerId = await repository.projectOwnerId(projectId);
      notifyMilestoneDisputed(deps, projectOwnerId, projectId, milestone.name, input.reason, actor.id);
      await recordEvent(projectId, "dispute_raised", actor, `Raised dispute · ${milestone.name}`, num(milestone.amount), milestoneId);
      return toDispute(row);
    },

    async updateContractSum(
      projectId: string,
      input: UpdateContractSumInput,
      actor?: FinanceActor,
    ): Promise<ProjectFinances> {
      if (input.contractSum < 0) {
        throw new BadRequestError("Contract sum cannot be negative");
      }
      await repository.updateContractSum(projectId, input.contractSum);
      await recordEvent(projectId, "milestone_updated", actor ?? null, `Updated contract sum · ${input.contractSum}`, input.contractSum);
      return this.getByProject(projectId);
    },

    async recordVariation(
      projectId: string,
      input: RecordVariationInput,
      actor?: FinanceActor,
    ): Promise<ProjectFinances> {
      if (input.amount === 0) {
        throw new BadRequestError("Variation amount cannot be zero");
      }
      await repository.recordVariation(projectId, input.amount);
      const sign = input.amount > 0 ? "+" : "";
      await recordEvent(
        projectId,
        "milestone_updated",
        actor ?? null,
        `Recorded variation · ${sign}${input.amount} (${input.description})`,
        input.amount,
      );
      return this.getByProject(projectId);
    },
  };
}

export type FinancesService = ReturnType<typeof financesService>;
