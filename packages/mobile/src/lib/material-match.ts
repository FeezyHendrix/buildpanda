/**
 * Whether two names mean the same material, by the rule the server's stock
 * ledger uses: case and spacing ignored, "bags of cement" is cement, and a
 * trailing plural does not make a new material. Kept in step with
 * packages/backend/src/modules/materials-ledger/units.ts.
 */
const PACKAGING = /^(bags?|sacks?|rolls?|sheets?|lengths?|pieces?|tonnes?|tons?) of /;

function variants(name: string): string[] {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const out = [normalized];
  const bare = normalized.replace(PACKAGING, "");
  if (bare !== normalized) out.push(bare);
  for (const value of [...out]) {
    if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) out.push(value.slice(0, -1));
    else if (value.length > 2) out.push(`${value}s`);
  }
  return out;
}

export function sameMaterial(a: string, b: string): boolean {
  const left = new Set(variants(a));
  return variants(b).some((value) => left.has(value));
}
