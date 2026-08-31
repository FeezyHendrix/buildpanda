import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import * as schema from "./schema";

/**
 * One database file per signed-in user.
 *
 * Partitioning by file name rather than a `userId` column means a missed filter
 * can't leak one crew member's rows to the next person on a shared site tablet,
 * and signing out is a file delete rather than a cascade of deletes.
 */
let current: { ownerId: string; db: ReturnType<typeof drizzle>; raw: SQLiteDatabase } | null = null;

function fileNameFor(ownerId: string): string {
  return `buildpanda_${ownerId.replace(/[^a-zA-Z0-9_-]/g, "")}.db`;
}

export function getDb(ownerId: string) {
  if (current?.ownerId === ownerId) return current.db;

  const raw = openDatabaseSync(fileNameFor(ownerId), { enableChangeListener: true });
  raw.execSync("PRAGMA foreign_keys = ON;");
  const db = drizzle(raw, { schema });
  current = { ownerId, db, raw };
  return db;
}

/** The raw handle, for `useMigrations` and change listeners. */
export function getRawDb(ownerId: string): SQLiteDatabase {
  getDb(ownerId);
  return current!.raw;
}

export type Db = ReturnType<typeof getDb>;
