import { randomUUID } from "node:crypto";

// Mirrors the backend `lib/ids.ts` exactly so seeded records match prod shape
// and satisfy FK/column constraints. Never hardcode IDs.
export function generateId(prefix?: string): string {
  const uuid = randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

// A short, collision-proof token to tag test data (names/emails) so parallel
// runs and workers never clash and teardown can target this run precisely.
const RUN_TOKEN = randomUUID().slice(0, 8);

export function runToken(): string {
  return RUN_TOKEN;
}

export function uniqueName(base: string): string {
  return `${base} ${RUN_TOKEN}-${randomUUID().slice(0, 4)}`;
}

export function uniqueEmail(role: string): string {
  return `e2e-${role}-${RUN_TOKEN}-${randomUUID().slice(0, 6)}@buildpanda.test`;
}
