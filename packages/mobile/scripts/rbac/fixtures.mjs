import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/expo-sqlite/driver';
import { setDbOwner } from '../../src/db/ownership.ts';
import { projectAccess } from '../../src/lib/project-access-store.ts';
export const scope = { userId: 'crew', organizationId: 'workspace', projectId: 'site' };
export const snapshot = (permissions = {}, extra = {}) => ({ ...scope, permissions, workspacePermissions: {}, capabilities: { canViewInternalRfis: true }, relationship: 'company', verifiedAt: Date.now(), version: 1, ...extra });
export function authorize(permissions = {}, extra = {}) {
  projectAccess.setScope(scope);
  projectAccess.invalidate('unknown');
  projectAccess.accept(snapshot(permissions, extra), projectAccess.getState().generation);
}
export function database(owner = scope.userId) {
  const raw = new DatabaseSync(':memory:');
  const folder = new URL('../../drizzle/', import.meta.url);
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', folder), 'utf8'));
  for (const entry of journal.entries) raw.exec(readFileSync(new URL(`${entry.tag}.sql`, folder), 'utf8'));
  const db = drizzle({ prepareSync(query) {
    const stmt = raw.prepare(query);
    return {
      executeSync(params) {
        stmt.setReturnArrays(false);
        if (!stmt.columns().length) { const result = stmt.run(...params); return { changes: result.changes, lastInsertRowId: result.lastInsertRowid }; }
        return { getAllSync: () => stmt.all(...params), getFirstSync: () => stmt.get(...params) };
      },
      executeForRawResultSync(params) { stmt.setReturnArrays(true); return { getAllSync: () => stmt.all(...params) }; },
    };
  } });
  setDbOwner(db, owner);
  return { db, raw };
}
export const tick = () => new Promise((resolve) => setImmediate(resolve));
export function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
