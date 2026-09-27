// Composition facade for the take-off data access. The queries live in
// domain-scoped siblings; `preconRepository(db)` keeps the flat shape every
// caller already depends on.
import type { Knex } from "knex";
import { preconAuditRepository } from "./audit-repository.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import { preconProgrammeRepository } from "./programme-repository.ts";
import { applyRerun, beginRerun, type RerunToken } from "./rerun-apply.ts";
import { preconRowRepository } from "./row-repository.ts";
import { preconSessionRepository } from "./session-repository.ts";
import { preconSheetRepository } from "./sheet-repository.ts";

export { preconAuditRepository } from "./audit-repository.ts";
export { preconGeometryRepository } from "./geometry-repository.ts";
export { preconProgrammeRepository } from "./programme-repository.ts";
export { preconRowRepository } from "./row-repository.ts";
export { preconSessionRepository } from "./session-repository.ts";
export { preconSheetRepository } from "./sheet-repository.ts";
export type { PreconAuditRepository } from "./audit-repository.ts";
export type { PreconGeometryRepository } from "./geometry-repository.ts";
export type { PreconProgrammeRepository } from "./programme-repository.ts";
export type { PreconRowRepository } from "./row-repository.ts";
export type { PreconSessionRepository } from "./session-repository.ts";
export type { PreconSheetRepository } from "./sheet-repository.ts";
export type { RerunToken } from "./rerun-apply.ts";

export type PreconRepository = ReturnType<typeof preconRepository>;

export function preconRepository(db: Knex) {
  return {
    ...preconSessionRepository(db),
    ...preconSheetRepository(db),
    ...preconRowRepository(db),
    ...preconGeometryRepository(db),
    ...preconAuditRepository(db),
    ...preconProgrammeRepository(db),

    transaction: <T>(fn: (trx: Knex.Transaction) => Promise<T>) => db.transaction(fn),

    // The re-run's unit of work. It lives on the facade because the facade is
    // already where the connection handle lives, so a service composed from a
    // repository can apply a re-run inside the session lock without every
    // caller in the tree having to pass a Knex down to it.
    beginRerun: (sessionId: string) => beginRerun(db, sessionId),
    applyRerun: <T>(token: RerunToken, apply: (trx: Knex.Transaction) => Promise<T>) => applyRerun(db, token, apply),
  };
}
