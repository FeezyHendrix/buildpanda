import { drizzle } from "drizzle-orm/expo-sqlite";
import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import * as schema from "./schema";
import { setDbOwner } from "./ownership";
export { getDbOwner } from "./ownership";

function createDatabase(raw: SQLiteDatabase) {
  return drizzle(raw, { schema });
}

export type Db = ReturnType<typeof createDatabase>;

// Keep unsynced work in its owner's file when another person signs in.
const databases = new Map<string, Db>();
const handles = new Map<string, SQLiteDatabase>();
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
      handles.set(ownerId, raw);
      setDbOwner(db, ownerId);
      return db;
    } catch (error) {
      await raw.closeAsync().catch(() => undefined);
      throw error;
    }
  })().finally(() => opening.delete(ownerId));
  opening.set(ownerId, request);
  return request;
}

/**
 * Discards this owner's local store so a broken one can be rebuilt.
 *
 * A migration that throws throws the same way on every retry, so the store
 * error is otherwise a dead end with no route back into the app. Whatever was
 * still queued on the device goes with the file, which is why nothing calls
 * this automatically — only the person looking at the failure can choose it.
 */
export async function resetDb(ownerId: string): Promise<void> {
  const raw = handles.get(ownerId);
  databases.delete(ownerId);
  handles.delete(ownerId);
  if (raw) await raw.closeAsync().catch(() => undefined);
  await deleteDatabaseAsync(fileNameFor(ownerId));
}
