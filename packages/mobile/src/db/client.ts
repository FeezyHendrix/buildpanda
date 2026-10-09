import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import * as schema from "./schema";

function createDatabase(raw: SQLiteDatabase) {
  return drizzle(raw, { schema });
}

export type Db = ReturnType<typeof createDatabase>;

// Keep unsynced work in its owner's file when another person signs in.
const databases = new Map<string, Db>();
const owners = new WeakMap<Db, string>();
const opening = new Map<string, Promise<Db>>();

function fileNameFor(ownerId: string): string {
  return `buildpanda_${ownerId.replace(/[^a-zA-Z0-9_-]/g, "")}.db`;
}

/** Open without blocking rendering or a web worker's startup; reuse per owner. */
export function openDb(ownerId: string): Promise<Db> {
  const existing = databases.get(ownerId);
  if (existing) return Promise.resolve(existing);
  const pending = opening.get(ownerId);
  if (pending) return pending;
  const request = (async () => {
    const raw = await openDatabaseAsync(fileNameFor(ownerId), { enableChangeListener: true });
    try {
      await raw.execAsync("PRAGMA foreign_keys = ON;");
      const db = createDatabase(raw);
      databases.set(ownerId, db);
      owners.set(db, ownerId);
      return db;
    } catch (error) {
      await raw.closeAsync().catch(() => undefined);
      throw error;
    }
  })().finally(() => opening.delete(ownerId));
  opening.set(ownerId, request);
  return request;
}

/** Lets a running sync stop when the device switches accounts. */
export function getDbOwner(db: Db): string | undefined {
  return owners.get(db);
}
