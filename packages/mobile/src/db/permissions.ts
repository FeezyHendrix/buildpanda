import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "./client";
import { getDbOwner } from "./ownership";
import { AccessDeniedError, projectAccess, requirePermission } from "@/lib/project-access-store";
import { canAccess, requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { DENY, type FeatureAccess } from "@/lib/access-requirement";

export function requireDbPermission(db: Db, projectId: string, resource: string, action: string) {
  const access = requirePermission(projectId, resource, action);
  if (!access.scope || getDbOwner(db) !== access.scope.userId) throw new AccessDeniedError();
  return access;
}

/** A denied read executes a constant-false query, never an unscoped table read. */
export function localReadScope(db: Db, projectColumn: AnySQLiteColumn, resource: string): SQL {
  const { scope } = projectAccess.getState();
  if (!scope || getDbOwner(db) !== scope.userId || !projectAccess.can(scope.projectId, resource, "view")) return sql`0 = 1`;
  return eq(projectColumn, scope.projectId);
}

export function requireLocalRecord<T extends SQLiteTable & { id: AnySQLiteColumn; projectId: AnySQLiteColumn }>(
  db: Db, table: T, id: string, projectId: string, resource: string, action: string,
) {
  requireDbPermission(db, projectId, resource, action);
  const row = db.select().from(table).where(and(eq(table.id, id), eq(table.projectId, projectId))).get();
  if (!row) throw new AccessDeniedError("This record is not available in the selected project.");
  return row;
}

type LocalTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** A transaction that never opened, as opposed to a statement inside one failing. */
function isTransactionStartFailure(error: unknown): boolean {
  return /query\s+begin|cannot start a transaction|Sync operation timeout/i.test(messageOf(error));
}

/**
 * What the browser could offer the store when the write failed. Without it a
 * report reads "Failed to run the query begin", which names the symptom and
 * hides every cause.
 */
function storeState(): string {
  // Detected from the runtime rather than Platform.OS: importing react-native
  // here drags its Flow-typed entry into the node test graph, which cannot
  // parse it.
  if (typeof globalThis.crossOriginIsolated !== "boolean") return "native store";
  return `web store: crossOriginIsolated=${globalThis.crossOriginIsolated}, SharedArrayBuffer=${typeof SharedArrayBuffer !== "undefined"}, atomicsPause=${typeof (Atomics as { pause?: unknown }).pause === "function"}`;
}

/** Bind a repository to one declared feature, keeping SQL and policy separate. */
export function repositoryAccess(feature: FeatureAccess) {
  const policy = (operation: string) => operation === "read" ? feature.read : feature.actions[operation] ?? DENY;
  const require = (db: Db, projectId: string, operation = "read") => {
    const ticket = requireAccess(projectId, policy(operation));
    if (getDbOwner(db) !== ticket.scope?.userId) throw new AccessDeniedError();
    return ticket;
  };
  return {
    require,
    where(db: Db, projectColumn: AnySQLiteColumn, ...conditions: (SQL | undefined)[]): SQL {
      const { scope } = projectAccess.getState();
      if (!scope || getDbOwner(db) !== scope.userId || !canAccess(scope.projectId, feature.read)) return sql`0 = 1`;
      return and(eq(projectColumn, scope.projectId), ...conditions)!;
    },
    record<T extends SQLiteTable & { id: AnySQLiteColumn; projectId: AnySQLiteColumn }>(db: Db, table: T, id: string, projectId: string) {
      require(db, projectId);
      const row = db.select().from(table).where(and(eq(table.id, id), eq(table.projectId, projectId))).get();
      if (!row) throw new AccessDeniedError("This record is not available in the selected project.");
      return row;
    },
    transaction<T>(db: Db, projectId: string, operation: string, run: (tx: LocalTransaction) => T): T {
      const ticket = require(db, projectId, operation);
      const attempt = () => db.transaction((tx) => { requireCurrentAccess(ticket); return run(tx); });
      try {
        return attempt();
      } catch (error) {
        // On web there is no synchronous SQLite: expo-sqlite spin-waits on a
        // SharedArrayBuffer for the worker, so a slow OPFS write surfaces as
        // the opening BEGIN failing rather than as a real SQL error. Losing a
        // crew's record to that is worse than paying for one more attempt.
        if (!isTransactionStartFailure(error)) throw error;
        try {
          return attempt();
        } catch (retry) {
          throw new Error(`${messageOf(retry)} — ${storeState()}`);
        }
      }
    },
  };
}
