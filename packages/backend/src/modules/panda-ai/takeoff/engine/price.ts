import type { PreconBoqRowRow, PreconRateRow } from "../types.ts";

const STOPWORDS = new Set(["in", "of", "to", "and", "the", "with", "as", "per", "for", "or"]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export interface PricedPatch {
  rate: number;
  amount: number | null;
  rate_source: string;
}

// Rate matching precedence: unit must match; code prefix narrows; description
// similarity breaks ties. Unmatched rows stay unpriced for the QS.
export function matchRate(
  row: Pick<PreconBoqRowRow, "code" | "description" | "unit" | "qty">,
  rates: PreconRateRow[],
): PreconRateRow | null {
  if (!row.unit) return null;
  const unitMatches = rates.filter((r) => r.unit.toLowerCase() === row.unit!.toLowerCase());
  if (unitMatches.length === 0) return null;

  let best: { rate: PreconRateRow; score: number } | null = null;
  for (const rate of unitMatches) {
    let score = 0;
    if (rate.code_prefix) {
      if (!row.code || !row.code.toUpperCase().startsWith(rate.code_prefix.toUpperCase())) continue;
      score += 1;
    }
    if (rate.description_pattern) {
      const sim = similarity(row.description, rate.description_pattern);
      if (sim < 0.5) continue;
      score += sim;
    }
    if (!best || score > best.score) best = { rate, score };
  }
  return best && best.score > 0 ? best.rate : null;
}

export function priceRow(
  row: Pick<PreconBoqRowRow, "code" | "description" | "unit" | "qty">,
  rates: PreconRateRow[],
  cardName: string,
): PricedPatch | null {
  const rate = matchRate(row, rates);
  if (!rate) return null;
  const rateValue = Number(rate.rate);
  const qty = row.qty === null ? null : Number(row.qty);
  return {
    rate: rateValue,
    amount: qty === null ? null : Math.round(qty * rateValue * 100) / 100,
    rate_source: `${cardName}`,
  };
}
