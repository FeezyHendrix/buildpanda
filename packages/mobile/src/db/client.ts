import { drizzle } from "drizzle-orm/expo-sqlite";
import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
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
      if (Platform.OS === "web") reloadIfWorkerStalls(raw);
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

const PING_TIMEOUT_MS = 10_000;

/**
 * On web the database lives in a worker and every query spins the main thread
 * until the worker answers. After the tab has been in the background that
 * answer sometimes never comes, so each query hangs for its 15 second limit and
 * the page looks frozen with nothing tappable. A reload rebuilds the worker;
 * the store itself is on disk, so nothing queued is lost.
 * shortcut: a reload mid-form drops what was typed, replace when web queries move off the main thread
 */
function reloadIfWorkerStalls(raw: SQLiteDatabase): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const timeout = new Promise<"stalled">((resolve) => setTimeout(() => resolve("stalled"), PING_TIMEOUT_MS));
    // a rejected ping (closed handle after a reset) is still an answer
    void Promise.race([raw.getFirstAsync("SELECT 1"), timeout])
      .then((result) => { if (result === "stalled") window.location.reload(); })
      .catch(() => undefined);
  });
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
