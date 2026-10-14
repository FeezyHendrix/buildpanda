/**
 * Whether two typed names mean the same material, by one rule everywhere:
 * case and spacing ignored, "bags of cement" is cement, and a trailing
 * plural is not a new material. The stock ledger keys lines on it, orders
 * link to approvals by it, and the phone suggests orders with it.
 */

/**
 * Spellings of a material name that mean the same thing: "blocks" and
 * "block", "bags of cement" and "cement". Exact comes first so an existing
 * line is always preferred over a looser match.
 */
const PACKAGING = /^(bags?|sacks?|rolls?|sheets?|lengths?|pieces?|tonnes?|tons?) of /i;

/** "Bags of cement" is cement; the bag is the unit, not part of the name. */
export function withoutPackaging(name: string): string {
  return name.replace(PACKAGING, "");
}

export function nameVariants(normalized: string): string[] {
  const variants = [normalized];
  const bare = withoutPackaging(normalized);
  if (bare !== normalized) variants.push(bare);
  for (const name of [...variants]) {
    if (name.length > 3 && name.endsWith("s") && !name.endsWith("ss")) variants.push(name.slice(0, -1));
    else if (name.length > 2) variants.push(`${name}s`);
  }
  return [...new Set(variants)];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Whether two records name the same material, by the same rule the ledger
 * uses to pick a stock line. Approvals, orders and deliveries are typed by
 * different people; "Bags of cement" on the order is the cement that was
 * approved, so a link between them must not depend on identical spelling.
 */
export function sameMaterial(a: string, b: string): boolean {
  const left = new Set(nameVariants(normalizeName(a)));
  return nameVariants(normalizeName(b)).some((variant) => left.has(variant));
}
