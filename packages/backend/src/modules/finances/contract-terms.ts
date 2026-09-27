import { BadRequestError } from "../../lib/errors.ts";
import {
  ADVANCE_RECOVERY_MODES,
  CONTRACT_FORMS,
  CONTRACT_TYPES,
  RETENTION_RELEASE_MODES,
  VALUATION_FREQUENCIES,
  type ContractTerms,
  type ContractTermsPatch,
  type FinancesRow,
  type UpdateContractTermsInput,
} from "./types.ts";

/**
 * Contract terms: validation and the row↔DTO mapping, kept out of the finances
 * service so one concern lives in one file.
 *
 * Every rate is a FRACTION on the way in and on the way out. Anything that
 * looks like a percentage (a value above 1 on a rate field) is rejected rather
 * than silently divided — a silent conversion is how `advanceRecoveryRate`
 * ended up storing 10 next to a `retentionRate` of 0.05.
 */

function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function isoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function toContractTerms(row: FinancesRow): ContractTerms {
  return {
    contractType: row.contract_type,
    retentionRate: num(row.retention_rate),
    retentionReleaseMode: row.retention_release_mode,
    retentionCapPercent: num(row.retention_cap_percent),
    advancePercentage: num(row.advance_percentage),
    advanceRecoveryMode: row.advance_recovery_mode,
    advanceRecoveryRate: num(row.advance_recovery_rate),
    advanceRecoveryFromCertificate: Number(row.advance_recovery_from_certificate ?? 2),
    paymentTermsDays: row.payment_terms_days,
    defectsLiabilityDays: row.defects_liability_days,
    defectsPeriodMonths: Number(row.defects_period_months ?? 12),
    vatRate: num(row.vat_rate),
    liquidatedDamagesRate: num(row.liquidated_damages_rate),
    liquidatedDamagesCapPercent: num(row.liquidated_damages_cap_percent),
    commencementDate: isoDate(row.commencement_date),
    completionDate: isoDate(row.completion_date),
    employerName: row.employer_name,
    contractorName: row.contractor_name,
    contractForm: row.contract_form,
    valuationFrequency: row.valuation_frequency ?? "monthly",
    contractNotes: row.contract_notes,
  };
}

function assertFraction(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new BadRequestError(`${label} must be a fraction between 0 and 1 (0.05 for 5%)`);
  }
}

function assertMember(value: string, allowed: readonly string[], label: string): void {
  if (!allowed.includes(value)) throw new BadRequestError(`Unknown ${label}`);
}

function assertWholeDays(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestError(`${label} must be a non-negative whole number`);
  }
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Validates the terms input and folds it into the column patch the repository writes. */
export function contractTermsPatch(input: UpdateContractTermsInput): ContractTermsPatch {
  const patch: ContractTermsPatch = {};

  if (input.contractType !== undefined) {
    assertMember(input.contractType, CONTRACT_TYPES, "contract type");
    patch.contract_type = input.contractType;
  }
  if (input.retentionRate !== undefined) {
    assertFraction(input.retentionRate, "Retention rate");
    patch.retention_rate = input.retentionRate;
  }
  if (input.retentionReleaseMode !== undefined) {
    assertMember(input.retentionReleaseMode, RETENTION_RELEASE_MODES, "retention release mode");
    patch.retention_release_mode = input.retentionReleaseMode;
  }
  if (input.retentionCapPercent !== undefined) {
    assertFraction(input.retentionCapPercent, "Retention cap");
    patch.retention_cap_percent = input.retentionCapPercent;
  }
  if (input.advancePercentage !== undefined) {
    assertFraction(input.advancePercentage, "Advance percentage");
    patch.advance_percentage = input.advancePercentage;
  }
  if (input.advanceRecoveryMode !== undefined) {
    assertMember(input.advanceRecoveryMode, ADVANCE_RECOVERY_MODES, "advance recovery mode");
    patch.advance_recovery_mode = input.advanceRecoveryMode;
  }
  if (input.advanceRecoveryRate !== undefined) {
    // A fraction like every other rate — 10 here used to mean 10%, and the
    // data migration normalised the stored values, so the door closes here.
    assertFraction(input.advanceRecoveryRate, "Advance recovery rate");
    patch.advance_recovery_rate = input.advanceRecoveryRate;
  }
  if (input.advanceRecoveryFromCertificate !== undefined) {
    if (!Number.isInteger(input.advanceRecoveryFromCertificate) || input.advanceRecoveryFromCertificate < 1) {
      throw new BadRequestError("Advance recovery must start from certificate 1 or later");
    }
    patch.advance_recovery_from_certificate = input.advanceRecoveryFromCertificate;
  }
  if (input.vatRate !== undefined) {
    assertFraction(input.vatRate, "VAT rate");
    patch.vat_rate = input.vatRate;
  }
  if (input.paymentTermsDays !== undefined) {
    assertWholeDays(input.paymentTermsDays, "Payment terms");
    patch.payment_terms_days = input.paymentTermsDays;
  }
  if (input.defectsPeriodMonths !== undefined) {
    assertWholeDays(input.defectsPeriodMonths, "Defects liability period");
    patch.defects_period_months = input.defectsPeriodMonths;
    // Kept in step so the legacy field never contradicts the months figure.
    patch.defects_liability_days = input.defectsPeriodMonths * 30;
  } else if (input.defectsLiabilityDays !== undefined) {
    assertWholeDays(input.defectsLiabilityDays, "Defects liability");
    patch.defects_liability_days = input.defectsLiabilityDays;
    patch.defects_period_months = Math.max(1, Math.round(input.defectsLiabilityDays / 30));
  }
  if (input.liquidatedDamagesRate !== undefined) {
    if (!Number.isFinite(input.liquidatedDamagesRate) || input.liquidatedDamagesRate < 0) {
      throw new BadRequestError("Liquidated damages rate cannot be negative");
    }
    patch.liquidated_damages_rate = input.liquidatedDamagesRate;
  }
  if (input.liquidatedDamagesCapPercent !== undefined) {
    assertFraction(input.liquidatedDamagesCapPercent, "Liquidated damages cap");
    patch.liquidated_damages_cap_percent = input.liquidatedDamagesCapPercent;
  }
  if (input.commencementDate !== undefined) patch.commencement_date = text(input.commencementDate);
  if (input.completionDate !== undefined) patch.completion_date = text(input.completionDate);
  if (
    patch.commencement_date &&
    patch.completion_date &&
    patch.completion_date < patch.commencement_date
  ) {
    throw new BadRequestError("The contract completion date cannot fall before commencement");
  }
  if (input.employerName !== undefined) patch.employer_name = text(input.employerName);
  if (input.contractorName !== undefined) patch.contractor_name = text(input.contractorName);
  if (input.contractForm !== undefined) {
    const form = text(input.contractForm);
    if (form) assertMember(form, CONTRACT_FORMS, "contract form");
    patch.contract_form = form;
  }
  if (input.valuationFrequency !== undefined) {
    assertMember(input.valuationFrequency, VALUATION_FREQUENCIES, "valuation frequency");
    patch.valuation_frequency = input.valuationFrequency;
  }
  if (input.contractNotes !== undefined) patch.contract_notes = text(input.contractNotes);

  return patch;
}
