import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { MilestoneClaimState } from "../finances/types.ts";
import { computeClaimDeductions } from "./deductions.ts";
import type { PaymentClaimsRepository, PaymentClaimUpdatePatch } from "./repository.ts";
import type { PaymentClaim, PaymentClaimRow, PaymentClaimStatus, RecordInvoiceInput } from "./types.ts";

export interface CreatePaymentClaimInput {
  milestonePaymentId?: string | null;
  claimNumber: string;
  periodStart?: string;
  periodEnd?: string;
  amount: number;
  status?: PaymentClaimStatus;
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export interface EditPaymentClaimInput {
  milestonePaymentId?: string | null;
  claimNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  amount?: number;
  status?: PaymentClaimStatus;
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export interface ClaimActor {
  id: string;
  name: string;
}

// The milestone chain lives in the finances module; the claims service talks
// to it through this seam so a claim never writes another module's tables.
export interface ClaimChainDeps {
  setMilestoneClaimState?: (projectId: string, milestoneId: string, state: MilestoneClaimState) => Promise<void>;
  recordCertification?: (
    projectId: string,
    input: { claimId: string; certified: number; retention: number; advanceRecovery: number; invoiceNumber: string },
    actor: ClaimActor,
  ) => Promise<void>;
  recordClaimPayment?: (
    projectId: string,
    input: { claimId: string; amount: number; description: string },
    actor: ClaimActor | null,
  ) => Promise<void>;
}

function optional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function money(value: string | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function timestampFor(status: PaymentClaimStatus): string | null {
  return status === "Submitted" || status === "Approved" || status === "Paid"
    ? new Date().toISOString()
    : null;
}

function approvalTimestampFor(status: PaymentClaimStatus): string | null {
  return status === "Approved" || status === "Paid" ? new Date().toISOString() : null;
}

// What the milestone should read once a claim reaches a status. Rejected and
// Draft hand the milestone back to claimable so the contractor can try again.
const MILESTONE_STATE_FOR_STATUS: Record<PaymentClaimStatus, MilestoneClaimState> = {
  Draft: "claimable",
  Submitted: "claimed",
  Approved: "claimed",
  Rejected: "claimable",
  Paid: "paid",
};

function toPaymentClaim(row: PaymentClaimRow): PaymentClaim {
  return {
    id: row.id,
    projectId: row.project_id,
    milestonePaymentId: row.milestone_payment_id,
    claimNumber: row.claim_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: Number(row.amount),
    status: row.status,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    notes: row.notes,
    retentionAmount: money(row.retention_amount),
    advanceRecoveryAmount: money(row.advance_recovery_amount),
    vatAmount: money(row.vat_amount),
    whtAmount: money(row.wht_amount),
    invoiceAmount: money(row.invoice_amount),
    invoiceNumber: row.invoice_number,
    invoiceRecordedAt: iso(row.invoice_recorded_at),
    invoiceRecordedBy: row.invoice_recorded_by,
    createdAt: iso(row.created_at) ?? "",
  };
}

export function paymentClaimsService(repository: PaymentClaimsRepository, chain: ClaimChainDeps = {}) {
  async function getOwnedClaim(projectId: string, claimId: string): Promise<PaymentClaimRow> {
    const existing = await repository.findById(claimId);
    if (!existing || existing.project_id !== projectId) {
      throw new NotFoundError("Payment claim");
    }
    return existing;
  }

  async function assertSingleOpenClaim(milestoneId: string | null | undefined, excludeId?: string): Promise<void> {
    if (!milestoneId) return;
    const open = await repository.openClaimForMilestone(milestoneId, excludeId);
    if (open) throw new BadRequestError(`This stage already has an open claim (${open.claim_number})`);
  }

  async function syncMilestone(projectId: string, milestoneId: string | null, status: PaymentClaimStatus): Promise<void> {
    if (!milestoneId || !chain.setMilestoneClaimState) return;
    await chain.setMilestoneClaimState(projectId, milestoneId, MILESTONE_STATE_FOR_STATUS[status]);
  }

  // Approval is the moment the certified sum is fixed, so the deductions are
  // computed once here and stored with the claim.
  async function deductionsPatch(projectId: string, certified: number): Promise<PaymentClaimUpdatePatch> {
    const ctx = await repository.billingContext(projectId);
    const d = computeClaimDeductions(certified, ctx);
    return {
      retention_amount: d.retention.toFixed(2),
      advance_recovery_amount: d.advanceRecovery.toFixed(2),
      vat_amount: d.vat.toFixed(2),
      wht_amount: d.wht.toFixed(2),
      invoice_amount: d.invoice.toFixed(2),
    };
  }

  return {
    async listByProject(projectId: string): Promise<PaymentClaim[]> {
      const rows = await repository.listByProject(projectId);
      return rows.map(toPaymentClaim);
    },

    async create(projectId: string, input: CreatePaymentClaimInput): Promise<PaymentClaim> {
      if (input.amount < 0) throw new BadRequestError("Payment claim amount cannot be negative");
      await assertSingleOpenClaim(input.milestonePaymentId);
      const status = input.status ?? "Draft";
      const row = await repository.create({
        id: generateId("pc"),
        project_id: projectId,
        milestone_payment_id: input.milestonePaymentId ?? null,
        claim_number: input.claimNumber.trim(),
        period_start: optional(input.periodStart) ?? null,
        period_end: optional(input.periodEnd) ?? null,
        amount: String(input.amount),
        status,
        submitted_at: optional(input.submittedAt) ?? timestampFor(status),
        approved_at: optional(input.approvedAt) ?? approvalTimestampFor(status),
        notes: optional(input.notes) ?? null,
      });
      let saved = row;
      if (status === "Approved" || status === "Paid") {
        saved = (await repository.update(row.id, await deductionsPatch(projectId, input.amount))) ?? row;
      }
      await syncMilestone(projectId, saved.milestone_payment_id, status);
      return toPaymentClaim(saved);
    },

    async edit(projectId: string, claimId: string, input: EditPaymentClaimInput): Promise<PaymentClaim> {
      const existing = await getOwnedClaim(projectId, claimId);
      if (input.amount !== undefined && input.amount < 0) {
        throw new BadRequestError("Payment claim amount cannot be negative");
      }
      if (input.milestonePaymentId !== undefined && input.milestonePaymentId !== existing.milestone_payment_id) {
        await assertSingleOpenClaim(input.milestonePaymentId, claimId);
      }

      const patch: PaymentClaimUpdatePatch = {};
      if (input.milestonePaymentId !== undefined) patch.milestone_payment_id = input.milestonePaymentId || null;
      if (input.claimNumber !== undefined) patch.claim_number = input.claimNumber.trim();
      if (input.periodStart !== undefined) patch.period_start = optional(input.periodStart) ?? null;
      if (input.periodEnd !== undefined) patch.period_end = optional(input.periodEnd) ?? null;
      if (input.amount !== undefined) patch.amount = String(input.amount);
      if (input.status !== undefined) {
        patch.status = input.status;
        if (!existing.submitted_at) patch.submitted_at = timestampFor(input.status);
        if (!existing.approved_at) patch.approved_at = approvalTimestampFor(input.status);
      }
      if (input.submittedAt !== undefined) patch.submitted_at = optional(input.submittedAt) ?? null;
      if (input.approvedAt !== undefined) patch.approved_at = optional(input.approvedAt) ?? null;
      if (input.notes !== undefined) patch.notes = optional(input.notes) ?? null;

      const nextStatus = input.status ?? existing.status;
      const becameApproved = nextStatus === "Approved" && existing.status !== "Approved";
      const amountChangedWhileApproved = nextStatus === "Approved" && input.amount !== undefined;
      if (becameApproved || amountChangedWhileApproved) {
        Object.assign(patch, await deductionsPatch(projectId, input.amount ?? Number(existing.amount)));
      }

      const row = await repository.update(claimId, patch);
      if (!row) throw new NotFoundError("Payment claim");
      if (input.status !== undefined && input.status !== existing.status) {
        await syncMilestone(projectId, row.milestone_payment_id, input.status);
        if (input.status === "Paid" && chain.recordClaimPayment) {
          await chain.recordClaimPayment(
            projectId,
            { claimId: row.id, amount: Number(row.invoice_amount ?? row.amount), description: `Payment · ${row.claim_number}` },
            null,
          );
        }
      }
      return toPaymentClaim(row);
    },

    // Recording the invoice is the certification step: the claim keeps its
    // number, the milestone reads certified, and the project's certified and
    // retention figures move. It logs something that happened at the bank.
    async recordInvoice(
      projectId: string,
      claimId: string,
      input: RecordInvoiceInput,
      actor: ClaimActor,
    ): Promise<PaymentClaim> {
      const existing = await getOwnedClaim(projectId, claimId);
      if (existing.status !== "Approved") {
        throw new BadRequestError("Only an approved claim can have its invoice recorded");
      }
      if (existing.invoice_recorded_at) {
        throw new BadRequestError(`Invoice ${existing.invoice_number ?? ""} is already recorded for this claim`);
      }
      const invoiceNumber = input.invoiceNumber.trim();
      if (!invoiceNumber) throw new BadRequestError("Invoice number is required");

      const deductions = existing.invoice_amount === null ? await deductionsPatch(projectId, Number(existing.amount)) : {};
      const row = await repository.update(claimId, {
        ...deductions,
        invoice_number: invoiceNumber,
        invoice_recorded_at: new Date().toISOString(),
        invoice_recorded_by: actor.id,
      });
      if (!row) throw new NotFoundError("Payment claim");

      if (row.milestone_payment_id && chain.setMilestoneClaimState) {
        await chain.setMilestoneClaimState(projectId, row.milestone_payment_id, "certified");
      }
      await chain.recordCertification?.(
        projectId,
        {
          claimId: row.id,
          certified: Number(row.amount),
          retention: Number(row.retention_amount ?? 0),
          advanceRecovery: Number(row.advance_recovery_amount ?? 0),
          invoiceNumber,
        },
        actor,
      );
      return toPaymentClaim(row);
    },

    async remove(projectId: string, claimId: string): Promise<void> {
      const existing = await getOwnedClaim(projectId, claimId);
      const deleted = await repository.deleteClaim(claimId);
      if (deleted === 0) throw new NotFoundError("Payment claim");
      if (existing.milestone_payment_id) await syncMilestone(projectId, existing.milestone_payment_id, "Rejected");
    },
  };
}
