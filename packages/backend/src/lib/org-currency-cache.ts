import type { Knex } from "knex";

interface CacheEntry {
  currency: string | null;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function getOrgDefaultCurrency(db: Knex, organizationId: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > now) return cached.currency;

  const org = await db("organization")
    .where({ id: organizationId })
    .first<{ default_currency: string | null }>("default_currency");
  const currency = org?.default_currency ?? null;
  cache.set(organizationId, { currency, expiresAt: now + TTL_MS });
  return currency;
}

export function invalidateOrgDefaultCurrency(organizationId: string): void {
  cache.delete(organizationId);
}
