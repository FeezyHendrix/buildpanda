// A selection saved as one act.
//
// Moving four shapes used to be four operations: four receipts, four history
// entries, and four chances for the last to fail after the first three had
// committed — leaving a drawing half-moved with no single thing to undo. The
// client was papering over a missing envelope by looping, which is exactly the
// workaround an atomic API exists to remove.
//
// So a batch is ONE command carrying a list. The whole list is preflighted
// before anything is written — every member's grants, every member's scope, and
// the union bounded as one operation — then executed inside the one transaction
// the envelope already owns. A single stale member therefore writes nothing,
// not "three of four".
//
// A batch may not contain a batch. Nesting buys nothing and turns the bound on
// the union into a bound on a tree.

import { BadRequestError } from "../../../lib/errors.ts";
import type { CommandContext, CommandScope } from "./editor-command-scope.ts";
import type { BatchCommand, EditorCommand } from "./editor-command-types.ts";
import type { EditorGrants } from "./editor-operation-types.ts";

/** Contract 9's ceiling on one operation, applied to the list itself. */
const MAX_COMMANDS = 200;

export function membersOf(command: BatchCommand): EditorCommand[] {
  const commands = command.commands;
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new BadRequestError("A batch needs at least one step");
  }
  if (commands.length > MAX_COMMANDS) {
    throw new BadRequestError(`A batch carries at most ${MAX_COMMANDS} steps; split the selection`);
  }
  for (const member of commands) {
    if (typeof member !== "object" || member === null) throw new BadRequestError("Every batch step is a command");
    if ((member as { kind?: unknown }).kind === "batch") {
      throw new BadRequestError("A batch cannot nest inside another batch");
    }
  }
  return commands;
}

export interface BatchPlan {
  members: EditorCommand[];
  scope: CommandScope;
}

/**
 * Everything the batch will touch, resolved before a byte is written, and the
 * union bounded once. Resolving per member as it executes would let step 200
 * discover it is over the cap after 199 have landed.
 */
export async function planBatch(
  context: CommandContext,
  command: BatchCommand,
  scopeOfMember: (context: CommandContext, member: EditorCommand) => Promise<CommandScope>,
): Promise<BatchPlan> {
  const members = membersOf(command);
  const rowIds = new Set<string>();
  const geometryIds = new Set<string>();
  const sheetIds = new Set<string>();
  const markupIds = new Set<string>();
  for (const member of members) {
    const scope = await scopeOfMember(context, member);
    for (const id of scope.rowIds) rowIds.add(id);
    for (const id of scope.geometryIds) geometryIds.add(id);
    for (const id of scope.sheetIds) sheetIds.add(id);
    for (const id of scope.markupIds) markupIds.add(id);
  }
  return {
    members,
    scope: {
      rowIds: [...rowIds],
      geometryIds: [...geometryIds],
      sheetIds: [...sheetIds],
      markupIds: [...markupIds],
    },
  };
}

/**
 * Every member's grants, checked before any of them runs. A batch whose fourth
 * step needs `verify` must be refused outright, not after three have committed.
 */
export function assertBatchGrants(
  command: BatchCommand,
  verify: boolean,
  grants: EditorGrants,
  assertOne: (member: EditorCommand, verify: boolean, grants: EditorGrants) => void,
): void {
  for (const member of membersOf(command)) assertOne(member, verify, grants);
}

export interface BatchRunner {
  plan: typeof planBatch;
  scopeOf: (context: CommandContext, member: EditorCommand) => Promise<CommandScope>;
  execute: (context: CommandContext, member: EditorCommand) => Promise<BatchOutcome>;
  nothing: Omit<BatchOutcome, "action">;
}

export interface BatchOutcome {
  action: string;
  createdRowIds: string[];
  createdGeometryIds: string[];
  deletedRowIds: string[];
  deletedGeometryIds: string[];
}

/**
 * The list, in order, inside the transaction the envelope already owns. A throw
 * from any member rolls the whole list back — which is what "one stale member
 * means none of it" actually is, rather than a compensating loop.
 */
export async function runBatch(
  context: CommandContext,
  command: BatchCommand,
  runner: BatchRunner,
): Promise<BatchOutcome> {
  const { members } = await runner.plan(context, command, runner.scopeOf);
  const merged: BatchOutcome = { action: "batch_edited", ...runner.nothing };
  let last = "batch_edited";
  for (const member of members) {
    const outcome = await runner.execute(context, member);
    last = outcome.action;
    merged.createdRowIds.push(...outcome.createdRowIds);
    merged.createdGeometryIds.push(...outcome.createdGeometryIds);
    merged.deletedRowIds.push(...outcome.deletedRowIds);
    merged.deletedGeometryIds.push(...outcome.deletedGeometryIds);
  }
  return { ...merged, action: members.length === 1 ? last : "batch_edited" };
}
