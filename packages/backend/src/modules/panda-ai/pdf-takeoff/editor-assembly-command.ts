// Creating an assembly's lines as one reversible operation.
//
// `assemblyMeasurement` already does the work and is already correct: one drawn
// shape, N priced lines, each with its own independent copy of the shape and its
// own frozen assembly snapshot. What it did not have was a receipt — the route
// wrote N rows straight onto the pool, so the whole set existed outside the undo
// stack and the editor's history simply did not contain it.
//
// So this composes the SAME service against the envelope's transaction rather
// than reimplementing it. Everything it writes is inside the session lock, and
// the operation's before/after state covers every row and shape it produced,
// which is what makes the whole set reversible together.

import { assemblyService } from "../../rate-library/assembly-service.ts";
import { rateLibraryRepository } from "../../rate-library/repository.ts";
import { assemblyMeasurement } from "./assembly-measure.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import type { AssemblyMeasurementResult, CreateAssemblyMeasurementBody } from "./types.ts";

/**
 * The assembly measure bound to this operation's transaction. The rate card is
 * read through the same transaction too, so the factors the lines are billed at
 * are the ones visible at the instant the lock was taken.
 */
export function assemblyMeasureIn(ctx: OperationWriteContext): ReturnType<typeof assemblyMeasurement> {
  const repo = preconRepository(ctx.trx);
  const assemblies = assemblyService(rateLibraryRepository(ctx.trx));
  // The manual-line helpers only; its audit and announce go through the bound
  // repository, and the envelope owns the operation-level audit entry.
  const manual = preconService(repo, (sessionId, event) => ctx.emit({ ...event, sessionId })).manualLine;
  return assemblyMeasurement({ repo, manual, loadAssembly: (orgId, id) => assemblies.priced(orgId, id) });
}

export async function createAssemblyIn(
  ctx: OperationWriteContext,
  sessionId: string,
  orgId: string,
  body: CreateAssemblyMeasurementBody,
  actor: string,
): Promise<AssemblyMeasurementResult> {
  return assemblyMeasureIn(ctx).create(sessionId, orgId, body, actor);
}
