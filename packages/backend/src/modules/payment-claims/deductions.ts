import { Money } from "../../lib/money.ts";

// The arithmetic a payment application carries when it is certified, following
// RICS interim valuation practice and Nigerian tax rules: retention and advance
// recovery come off the certified sum, VAT is charged on what remains, and the
// client's withholding tax is shown as their deduction from the invoice. Every
// figure is a stored record; nothing here moves money.

export interface BillingContext {
  /** Fraction, e.g. 0.05 for 5 %. */
  retentionRate: number;
  /** Fraction of each certified amount recovered against the advance, e.g. 0.2. */
  advanceRate: number;
  /** Total advance paid; recovery stops once this is fully recovered. */
  advanceTotal: number;
  /** Advance already recovered on earlier certificates. */
  advanceRecovered: number;
  /** Percent, e.g. 7.5. */
  vatPct: number;
  /** Percent, e.g. 2. */
  whtPct: number;
}

export interface ClaimDeductions {
  certified: number;
  retention: number;
  advanceRecovery: number;
  net: number;
  vat: number;
  invoice: number;
  wht: number;
}

const round2 = (m: Money): number => m.round(2).toNumber();

export function computeClaimDeductions(certified: number, ctx: BillingContext): ClaimDeductions {
  const certifiedMoney = Money.of(certified);
  const retention = certifiedMoney.mul(ctx.retentionRate).round(2);
  const remainingAdvance = Money.of(ctx.advanceTotal).sub(ctx.advanceRecovered);
  const advanceCandidate = certifiedMoney.mul(ctx.advanceRate).round(2);
  const advanceRecovery = remainingAdvance.isNegative()
    ? Money.zero()
    : advanceCandidate.gt(remainingAdvance)
      ? remainingAdvance.round(2)
      : advanceCandidate;
  const net = certifiedMoney.sub(retention).sub(advanceRecovery);
  const vat = net.percent(ctx.vatPct).round(2);
  const wht = net.percent(ctx.whtPct).round(2);
  return {
    certified: round2(certifiedMoney),
    retention: round2(retention),
    advanceRecovery: round2(advanceRecovery),
    net: round2(net),
    vat: round2(vat),
    invoice: round2(net.add(vat)),
    wht: round2(wht),
  };
}
