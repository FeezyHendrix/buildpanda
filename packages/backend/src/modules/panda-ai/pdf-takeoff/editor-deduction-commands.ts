// The five commands that take an opening off a measured line.
//
// Split out of `editor-operation-commands.ts` at the house 400-line ceiling, and
// a natural seam: three of them find their target by the opening's own geometry
// id, and two reach the legacy openings that have none. Keeping them together is
// what makes the difference between the two visible at the point of dispatch.
//
// Like its parent this is a seam, not a second implementation: every branch
// delegates to the shipped writer, and nothing here starts a transaction or
// takes a lock.

import { addDeductionIn, editDeductionIn, removeDeductionIn } from "./editor-deduction-writers.ts";
import { editStatedDeductionIn, removeStatedDeductionIn } from "./editor-stated-deduction-writers.ts";
import { rowInSession, type CommandContext } from "./editor-command-scope.ts";
import { requireRow } from "./editor-write-helpers.ts";
import type { CommandOutcome } from "./editor-operation-commands.ts";
import type { EditorDeductionCommand } from "./editor-deduction-command-types.ts";

const nothing = { createdRowIds: [], createdGeometryIds: [], deletedRowIds: [], deletedGeometryIds: [] };
const did = (action: string, over: Partial<CommandOutcome> = {}): CommandOutcome => ({ action, ...nothing, ...over });

export async function executeDeductionCommand(
  context: CommandContext,
  command: EditorDeductionCommand,
): Promise<CommandOutcome> {
  const { ctx, sessionId, actor } = context;
  const version = async (rowId: string): Promise<number> => (await requireRow(ctx, rowId)).version;

  switch (command.kind) {
    case "add-deduction": {
      const rowId = await rowInSession(context, command.rowId);
      const added = await addDeductionIn(
        ctx,
        sessionId,
        rowId,
        {
          version: await version(rowId),
          label: command.label,
          ...(command.vertices ? { vertices: command.vertices } : {}),
          ...(command.dimensions ? { dimensions: command.dimensions } : {}),
          ...(command.mode ? { mode: command.mode } : {}),
          ...(command.sheetId ? { sheetId: command.sheetId } : {}),
        },
        actor,
      );
      return did("deduction_added", { createdGeometryIds: [added.geometryId] });
    }
    case "edit-deduction": {
      const rowId = await rowInSession(context, command.rowId);
      await editDeductionIn(
        ctx,
        sessionId,
        rowId,
        command.geometryId,
        {
          version: await version(rowId),
          ...(command.mode ? { mode: command.mode } : {}),
          ...(command.vertices ? { vertices: command.vertices } : {}),
          ...(command.dimensions ? { dimensions: command.dimensions } : {}),
        },
        actor,
      );
      return did("deduction_edited");
    }
    case "remove-deduction": {
      const rowId = await rowInSession(context, command.rowId);
      await removeDeductionIn(ctx, sessionId, rowId, command.geometryId, { version: await version(rowId) }, actor);
      return did("deduction_removed", { deletedGeometryIds: [command.geometryId] });
    }
    // The row version travels ON the command here, not read live: an opening
    // with no shape is named by its position, and a position resolved against a
    // row that has moved since the caller saw it is a different opening.
    case "edit-stated-deduction": {
      await rowInSession(context, command.rowId);
      await editStatedDeductionIn(ctx, sessionId, command, actor);
      return did("stated_deduction_edited");
    }
    case "remove-stated-deduction": {
      await rowInSession(context, command.rowId);
      await removeStatedDeductionIn(ctx, sessionId, command, actor);
      return did("stated_deduction_removed");
    }
  }
}
