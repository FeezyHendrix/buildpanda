import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { PaymentClaimsRepository } from "./repository.ts";
import type { PaymentClaim, PaymentClaimRow, PaymentClaimStatus } from "./types.ts";

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

function optional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createdAt(row: PaymentClaimRow): string {
  return row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
}

function timestampFor(status: PaymentClaimStatus): string | null {
  return status === "Submitted" || status === "Approved" || status === "Paid"
    ? new Date().toISOString()
    : null;
}

function approvalTimestampFor(status: PaymentClaimStatus): string | null {
  return status === "Approved" || status === "Paid" ? new Date().toISOString() : null;
}

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
    createdAt: createdAt(row),
  };
}

export function paymentClaimsService(repository: PaymentClaimsRepository) {
  async function getOwnedClaim(
    projectId: string,
    claimId: string,
  ): Promise<PaymentClaimRow> {
    const existing = await repository.findById(claimId);
    if (!existing || existing.project_id !== projectId) {
      throw new NotFoundError("Payment claim");
    }
    return existing;
  }

  return {
    async listByProject(projectId: string): Promise<PaymentClaim[]> {
      const rows = await repository.listByProject(projectId);
      return rows.map(toPaymentClaim);
    },

    async create(
      projectId: string,
      input: CreatePaymentClaimInput,
    ): Promise<PaymentClaim> {
      if (input.amount < 0) throw new BadRequestError("Payment claim amount cannot be negative");
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
      return toPaymentClaim(row);
    },

    async edit(
      projectId: string,
      claimId: string,
      input: EditPaymentClaimInput,
    ): Promise<PaymentClaim> {
      const existing = await getOwnedClaim(projectId, claimId);
      if (input.amount !== undefined && input.amount < 0) {
        throw new BadRequestError("Payment claim amount cannot be negative");
      }

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.milestonePaymentId !== undefined) {
        patch.milestone_payment_id = input.milestonePaymentId || null;
      }
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

      const row = await repository.update(claimId, patch);
      if (!row) throw new NotFoundError("Payment claim");
      return toPaymentClaim(row);
    },

    async remove(projectId: string, claimId: string): Promise<void> {
      await getOwnedClaim(projectId, claimId);
      const deleted = await repository.deleteClaim(claimId);
      if (deleted === 0) throw new NotFoundError("Payment claim");
    },
  };
}
