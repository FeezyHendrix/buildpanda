import { Money } from "../../lib/money.ts";
import type { ContractTerms } from "../finances/types.ts";
import type { InvoiceCertificate, InvoiceLineItemInput } from "./types.ts";

/**
 * Seeding an interim payment certificate from the contract, not from defaults.
 *
 * A QS reads an IPC down three columns — previously certified, this
 * certificate, cumulative — and then the deductions that turn gross into net:
 * retention at the contract rate (respecting its cap), the advance being
 * recovered, and VAT at the contract rate. None of that belongs in a form
 * default: the contract says 5% retention and 10% recovery from IPC 2, so the
 * certificate says 5% and 10% from IPC 2.
 */

export interface IpcSeedInput {
  /** The stage lines this month bills, from the billing sheet. */
  lines: InvoiceLineItemInput[];
  /** Gross value certified on earlier certificates of this contract. */
  previousCertified: number;
  /** Retention already held, so the cap is measured on the running total. */
  retentionHeldToDate: number;
  /** The advance paid, from which recovery is taken. */
  advancePaid: number;
  /** The advance already recovered on earlier certificates. */
  advanceRecoveredToDate: number;
  /** 1 for IPC 1, 2 for IPC 2, … */
  certificateNumber: number;
  adjustedContract: number;
}

function lineTotal(lines: InvoiceLineItemInput[]): Money {
  return Money.sum(lines.map((line) => Money.of(line.quantity ?? 1).mul(line.unitRate ?? 0))).round(2);
}

/**
 * Retention on this certificate, stopping at the contract's cap. The cap is a
 * share of the contract value — once retention held reaches it, later
 * certificates accrue none.
 */
export function retentionForCertificate(
  terms: ContractTerms,
  thisCertificate: Money,
  retentionHeldToDate: number,
  adjustedContract: number,
): Money {
  if (terms.retentionRate <= 0) return Money.zero();
  const accrued = thisCertificate.mul(terms.retentionRate).round(2);
  if (terms.retentionCapPercent <= 0) return accrued;
  const cap = Money.of(adjustedContract).mul(terms.retentionCapPercent).round(2);
  const headroom = cap.sub(retentionHeldToDate).round(2);
  if (headroom.lte(0)) return Money.zero();
  return accrued.gt(headroom) ? headroom : accrued;
}

/**
 * Advance recovery on this certificate. Nothing is recovered before the
 * certificate the contract names (IPC 2 by default — the mobilisation
 * certificate itself never repays the advance), and recovery never exceeds
 * what is still outstanding on the advance.
 */
export function advanceRecoveryForCertificate(
  terms: ContractTerms,
  thisCertificate: Money,
  input: Pick<IpcSeedInput, "certificateNumber" | "advancePaid" | "advanceRecoveredToDate">,
): Money {
  if (input.advancePaid <= 0) return Money.zero();
  if (input.certificateNumber < terms.advanceRecoveryFromCertificate) return Money.zero();
  const outstanding = Money.of(input.advancePaid).sub(input.advanceRecoveredToDate).round(2);
  if (outstanding.lte(0)) return Money.zero();
  const due =
    terms.advanceRecoveryMode === "fixed"
      ? Money.of(terms.advanceRecoveryRate)
      : thisCertificate.mul(terms.advanceRecoveryRate).round(2);
  return due.gt(outstanding) ? outstanding : due;
}

/** The full certificate structure this month's lines produce under the contract. */
export function seedCertificate(terms: ContractTerms, input: IpcSeedInput): InvoiceCertificate {
  const thisCertificate = lineTotal(input.lines);
  const cumulative = Money.of(input.previousCertified).add(thisCertificate).round(2);
  const retention = retentionForCertificate(
    terms,
    thisCertificate,
    input.retentionHeldToDate,
    input.adjustedContract,
  );
  const advanceRecovery = advanceRecoveryForCertificate(terms, thisCertificate, input);
  const vat = thisCertificate.mul(terms.vatRate).round(2);
  const netPayable = thisCertificate
    .sub(retention)
    .sub(advanceRecovery)
    .add(vat)
    .round(2);

  return {
    number: input.certificateNumber,
    previousCertified: Money.of(input.previousCertified).round(2).toNumber(),
    thisCertificate: thisCertificate.toNumber(),
    cumulative: cumulative.toNumber(),
    retention: retention.toNumber(),
    vat: vat.toNumber(),
    advanceRecovery: advanceRecovery.toNumber(),
    netPayable: netPayable.toNumber(),
  };
}
