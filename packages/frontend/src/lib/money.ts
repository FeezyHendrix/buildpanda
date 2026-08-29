import Decimal from "decimal.js";

/**
 * Money — decimal-safe arithmetic for BuildPanda's finance code.
 *
 * BuildPanda LOGS money, it never transacts it: every amount here is a recorded
 * figure (an invoice total, a deposit, a released milestone) describing a real
 * movement that happened off-platform. Those figures still have to add up
 * exactly, so all money math goes through this wrapper instead of native
 * floating-point numbers (0.1 + 0.2 !== 0.3).
 *
 * Backed by decimal.js through an isolated constructor so we never mutate the
 * global Decimal config. Instances are immutable; every operation returns a new
 * Money. Values are currency-agnostic decimals — currency lives on the project
 * and is applied at the formatting boundary (lib/formatters, lib/currency).
 */

// Isolated constructor — never touches the global Decimal configuration.
// precision 40 comfortably covers contract-scale sums at 2 dp; ROUND_HALF_UP is
// the conventional financial rounding (ties away from zero).
const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = Money | number | string;

const DEFAULT_SCALE = 2;

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  private static toDecimal(input: MoneyInput): Decimal {
    if (input instanceof Money) return input.value;
    try {
      const decimal = new D(input);
      // Guard against NaN / Infinity leaking in from bad user input.
      return decimal.isFinite() ? decimal : new D(0);
    } catch {
      // Unparseable money input (e.g. a half-typed field) coerces to zero
      // rather than throwing mid-calculation or poisoning totals with NaN.
      return new D(0);
    }
  }

  static of(input: MoneyInput): Money {
    return input instanceof Money ? input : new Money(Money.toDecimal(input));
  }

  static zero(): Money {
    return new Money(new D(0));
  }

  static sum(items: MoneyInput[]): Money {
    return items.reduce<Money>((acc, item) => acc.add(item), Money.zero());
  }

  add(other: MoneyInput): Money {
    return new Money(this.value.plus(Money.toDecimal(other)));
  }

  sub(other: MoneyInput): Money {
    return new Money(this.value.minus(Money.toDecimal(other)));
  }

  mul(factor: MoneyInput): Money {
    return new Money(this.value.times(Money.toDecimal(factor)));
  }

  div(divisor: MoneyInput): Money {
    return new Money(this.value.dividedBy(Money.toDecimal(divisor)));
  }

  /** This amount times `rate` percent, e.g. `of(200).percent(7.5)` -> 15. */
  percent(rate: MoneyInput): Money {
    return new Money(this.value.times(Money.toDecimal(rate)).dividedBy(100));
  }

  /** Round to `scale` decimal places (default 2), ties away from zero. */
  round(scale: number = DEFAULT_SCALE): Money {
    return new Money(this.value.toDecimalPlaces(scale, D.ROUND_HALF_UP));
  }

  negated(): Money {
    return new Money(this.value.negated());
  }

  abs(): Money {
    return new Money(this.value.abs());
  }

  compare(other: MoneyInput): number {
    return this.value.comparedTo(Money.toDecimal(other));
  }

  eq(other: MoneyInput): boolean {
    return this.compare(other) === 0;
  }

  gt(other: MoneyInput): boolean {
    return this.compare(other) > 0;
  }

  gte(other: MoneyInput): boolean {
    return this.compare(other) >= 0;
  }

  lt(other: MoneyInput): boolean {
    return this.compare(other) < 0;
  }

  lte(other: MoneyInput): boolean {
    return this.compare(other) <= 0;
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  /** Native number — safe for display/formatting, NOT for further money math. */
  toNumber(): number {
    return this.value.toNumber();
  }

  /** Plain decimal string, no exponent, unrounded. */
  toString(): string {
    return this.value.toFixed();
  }

  /** Fixed-scale string (default 2 dp) for DB columns / serialization. */
  toFixed(scale: number = DEFAULT_SCALE): string {
    return this.value.toDecimalPlaces(scale, D.ROUND_HALF_UP).toFixed(scale);
  }

  toJSON(): string {
    return this.toString();
  }

  /**
   * Split this amount into parts proportional to `weights` at `scale` dp using
   * the largest-remainder method, so the parts sum EXACTLY to this amount with
   * no rounding drift. Assumes a non-negative amount and non-negative weights.
   */
  allocate(weights: number[], scale: number = DEFAULT_SCALE): Money[] {
    if (weights.length === 0) return [];
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (weightSum <= 0) return weights.map(() => Money.zero());

    const factor = new D(10).pow(scale);
    const totalMinor = this.value
      .times(factor)
      .toDecimalPlaces(0, D.ROUND_HALF_UP);
    const weightSumD = new D(weightSum);

    const parts = weights.map((weight) => {
      const ideal = totalMinor.times(weight).dividedBy(weightSumD);
      const floor = ideal.floor();
      return { minor: floor, frac: ideal.minus(floor) };
    });

    const allocated = parts.reduce(
      (sum, part) => sum.plus(part.minor),
      new D(0),
    );
    let remaining = totalMinor.minus(allocated).toNumber();

    const byLargestRemainder = parts
      .map((part, index) => ({ index, frac: part.frac }))
      .sort((a, b) => b.frac.comparedTo(a.frac));
    for (const { index } of byLargestRemainder) {
      if (remaining <= 0) break;
      const part = parts[index];
      if (part) {
        part.minor = part.minor.plus(1);
        remaining -= 1;
      }
    }

    return parts.map((part) => new Money(part.minor.dividedBy(factor)));
  }

  /** Split into `parts` equal shares that sum exactly to this amount. */
  split(parts: number, scale: number = DEFAULT_SCALE): Money[] {
    return this.allocate(new Array<number>(parts).fill(1), scale);
  }
}
