// The sentence a measured quantity is defended with.
//
// `measurement_basis` is the contractual record of HOW a bill line reached its
// figure — read out in a valuation meeting, and in a dispute. It therefore has
// to agree with the figure beside it after every edit, in any order.
//
// It did not. The sentence used to be maintained by two independent string
// editors that each knew only their own clause: `basisWithTypical` owned
// "× N typical floors" and the total, `basisWithDeductions` owned
// "− D deducted (…)". Each appended positionally and stripped only what it
// recognised, so the order of a QS's edits decided what the line ended up
// asserting:
//
//   * add an opening to a line that repeats, and the deduction clause landed
//     AFTER the typical total — orphaning "= 48 m2" mid-sentence and leaving
//     the net unstated ("24 m2 area on QA-01 × 2 typical floors = 48 m2
//     − 3 m2 deducted (…)" on a line billing 21);
//   * change the height or depth afterwards, and the writer built a fresh head
//     with no deduction clause in it, so the opening vanished from the sentence
//     while still coming off the figure ("… gross 4.8 m3 = 4.5 m3", no mention
//     of the 0.3 m3 duct);
//   * change typical afterwards, and the "− …" strip took the typical clause
//     with it.
//
// So the sentence is no longer edited. It is COMPOSED, every time, from the
// facts the row actually carries, in the order the arithmetic runs:
//
//     <head> [− D unit deducted (labels)] [× N typical floors] = net unit
//     net = (gross − Σdeductions) × typical
//
// The head — the drawn figure, its source, its scale and its tool factors — is
// the one part a writer owns, and it is preserved verbatim: this module only
// strips back the clauses it emitted itself. A line that records no basis at
// all still records none; it does not acquire a sentence nobody wrote.

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Named in the sentence while a line's openings take more off it than it measures. */
export const OVER_DEDUCTED_NOTE = "deductions exceed gross";

export interface BasisDeduction {
  label: string;
  qty: number;
}

export interface BasisFacts {
  /**
   * The sentence as stored, or a head a writer has just built. Null means the
   * line records no basis — which stays null, rather than being invented.
   */
  basis: string | null;
  /** The measured figure before openings and typical; the fallback head for a sentence with no words left. */
  gross: number | null;
  deductions: readonly BasisDeduction[];
  typical: number;
  /** (gross − Σdeductions) × typical, as the row's own maths computed it. */
  net: number;
  unit: string | null;
  /** How much the openings exceed the gross by, when a legacy line is mid-repair. */
  deficit?: number;
}

// Every clause this module emits, so it can take its own words back without
// touching a writer's head. `−` is the minus sign the deduction clause is
// written with (U+2212), not a hyphen; `(?:^|\s)` so a sentence that is
// nothing BUT clauses is stripped as readily as one with a head in front.
const DEDUCTION_CLAUSE = /(?:^|\s)−\s[\d.]+(?:\s[^\s(]+)?\sdeducted\s\([^)]*\)/gu;
const DEFICIT_NOTE = /(?:^|\s)\(deductions exceed gross\)/giu;
const TYPICAL_CLAUSE = /(?:^|\s)×\s\d+\stypical\s(?:floors|areas)/gu;
// A total belongs to this module only where a clause of its grammar follows it
// or the sentence ends; anything else with an "=" in it is a writer's words.
const TOTAL = /(?:^|\s)=\s[\d.]+(?:\s\S+)?(?=\s−\s|\s×\s\d+\stypical\s|$)/gu;
/** A head that already multiplies by something — a height, a depth, an assembly factor. */
const FACTOR_CLAUSE = /\s×\s/u;

const collapse = (text: string): string => text.replace(/\s+/gu, " ").trim();

/**
 * The writer's own words, with every clause this module has ever appended taken
 * back off — including a total left stranded mid-sentence by the old append
 * order, which is why this runs to a fixed point rather than once.
 */
export function basisHeadOf(basis: string): string {
  let head = basis;
  for (let pass = 0; pass < 4; pass++) {
    const next = head
      .replace(DEDUCTION_CLAUSE, "")
      .replace(DEFICIT_NOTE, "")
      .replace(TOTAL, "")
      .replace(TYPICAL_CLAUSE, "");
    if (next === head) break;
    head = next;
  }
  return collapse(head);
}

/**
 * The whole sentence, composed from the facts. Order is the order of the
 * arithmetic, so the words and the figure cannot disagree however the edits
 * that produced them were sequenced.
 */
export function basisFor(facts: BasisFacts): string | null {
  if (facts.basis === null) return null;
  const unit = facts.unit ?? "";
  // A sentence with nothing but clauses in it still has to say what was measured.
  const head = basisHeadOf(facts.basis) || collapse(`${facts.gross ?? facts.net} ${unit}`);
  const parts = [head];

  if (facts.deductions.length > 0) {
    const total = round2(facts.deductions.reduce((sum, entry) => sum + entry.qty, 0));
    const named = facts.deductions.map((entry) => entry.label).join(", ");
    parts.push(collapse(`− ${total} ${unit} deducted (${named})`));
    if ((facts.deficit ?? 0) > 0) parts.push(`(${OVER_DEDUCTED_NOTE})`);
  }
  if (facts.typical > 1) parts.push(`× ${facts.typical} typical floors`);

  // A bare drawn figure is its own total; restating it adds nothing a reader
  // can check. A figure something was applied to is not, so that one is stated.
  const applied = facts.deductions.length > 0 || facts.typical > 1 || FACTOR_CLAUSE.test(head);
  if (applied) parts.push(collapse(`= ${facts.net} ${unit}`));
  return collapse(parts.join(" "));
}
