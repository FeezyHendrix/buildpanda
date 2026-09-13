import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { FinancesRepository } from "./repository.ts";
import { contractTermsPatch } from "./contract-terms.ts";
import { milestoneService } from "./milestones.ts";
import { toCashFlowEntry, toEvent, toFinances } from "./finance-mapper.ts";
import {
  type CashFlowCategory,
  type CashFlowEntry,
  type FinanceEvent,
  type FinanceEventType,
  type ProjectFinances,
  type UpdateContractTermsInput,
} from "./types.ts";

export type { UpdateContractTermsInput };

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

export function financesService(repository: FinancesRepository, deps: FinancesDeps = {}) {
  // Stage payments (milestones and their disputes) are the FUNDING ledger, not
  // the contract waterfall; they live in their own file for that reason.
  const milestones = milestoneService(repository, deps);

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

    ...milestones,

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

    async updateContractTerms(
      projectId: string,
      input: UpdateContractTermsInput,
      actor?: FinanceActor,
    ): Promise<ProjectFinances> {
      if (input.contractSum !== undefined) {
        if (!Number.isFinite(input.contractSum) || input.contractSum < 0) {
          throw new BadRequestError("Contract sum cannot be negative");
        }
        await repository.updateContractSum(projectId, input.contractSum);
      }

      await repository.updateContractTerms(projectId, contractTermsPatch(input));
      await recordEvent(
        projectId,
        "milestone_updated",
        actor ?? null,
        "Updated contract terms",
        null,
      );
      return this.getByProject(projectId);
    },
  };
}

export type FinancesService = ReturnType<typeof financesService>;
