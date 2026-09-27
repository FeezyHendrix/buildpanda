import type { MeasuredItem } from "./types.ts";

export const PLAUSIBILITY_FLAGS = [
  "non_positive_quantity",
  "unit_mismatch",
  "quantity_out_of_band",
  "unknown_unit",
] as const;
export type PlausibilityFlag = (typeof PLAUSIBILITY_FLAGS)[number];

export interface FlaggedItem {
  item: MeasuredItem;
  flags: PlausibilityFlag[];
}

// Upper bands are deliberately generous — the goal is catching order-of-magnitude
// errors (a wrong scale turns 40 m2 into 4000 m2), not second-guessing a valid
// large project. A flag routes the item to human review; it never deletes it.
const UNIT_BANDS: Record<string, { min: number; max: number }> = {
  m: { min: 0, max: 100_000 },
  m2: { min: 0, max: 500_000 },
  m3: { min: 0, max: 200_000 },
  nr: { min: 0, max: 100_000 },
};

// Component measurements are dimensioned: linear runs in m, areas in m2, counts
// in nr. A ductwork run reported in "nr" or a fitting count in "m2" is a unit
// mismatch — a classic double-count / mis-classification signal.
const DIMENSION_UNITS = new Set(["m", "m2", "m3"]);
const COUNT_UNITS = new Set(["nr"]);

function isCountTrade(trade: string): boolean {
  return /fitting|sanitary|column|door|window|fixture/i.test(trade);
}

function isLinearOrAreaTrade(trade: string): boolean {
  return /wall|duct|pipe|floor|ceiling|roof|slab|render|paint/i.test(trade);
}

export function checkItem(item: MeasuredItem): PlausibilityFlag[] {
  const flags: PlausibilityFlag[] = [];
  const unit = item.unit.toLowerCase();

  if (!(unit in UNIT_BANDS)) {
    flags.push("unknown_unit");
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    flags.push("non_positive_quantity");
  }
  if (isCountTrade(item.trade) && DIMENSION_UNITS.has(unit)) {
    flags.push("unit_mismatch");
  }
  if (isLinearOrAreaTrade(item.trade) && COUNT_UNITS.has(unit)) {
    flags.push("unit_mismatch");
  }

  const band = UNIT_BANDS[unit];
  if (band && Number.isFinite(item.quantity) && (item.quantity < band.min || item.quantity > band.max)) {
    flags.push("quantity_out_of_band");
  }

  return flags;
}

// Returns only the items that tripped a plausibility flag, so the caller can
// surface them at the top of the review queue before any quantity is trusted.
export function flagImplausibleItems(items: MeasuredItem[]): FlaggedItem[] {
  return items
    .map((item) => ({ item, flags: checkItem(item) }))
    .filter((entry) => entry.flags.length > 0);
}
