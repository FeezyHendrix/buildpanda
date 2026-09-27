// The four redline commands, dispatched.
//
// Split out of `editor-operation-commands.ts` at the house 400-line ceiling.
// The writing still belongs to the drawing-markup module; this only chooses
// which of its methods a command means.

import { markupEditingIn } from "./editor-markup-writers.ts";
import { readMarkupGeometry as asMarkupGeometry } from "./editor-audit-parse.ts";
import type { CommandContext } from "./editor-command-scope.ts";
import type {
  DeleteMarkupCommand,
  EditMarkupCommand,
  EditMarkupCommentCommand,
  RestoreMarkupCommand,
} from "./editor-command-types.ts";

export type MarkupCommand =
  | EditMarkupCommand
  | DeleteMarkupCommand
  | RestoreMarkupCommand
  | EditMarkupCommentCommand;

export interface MarkupOutcome {
  action: string;
  createdRowIds: string[];
  createdGeometryIds: string[];
  deletedRowIds: string[];
  deletedGeometryIds: string[];
}

const did = (action: string): MarkupOutcome => ({
  action,
  createdRowIds: [],
  createdGeometryIds: [],
  deletedRowIds: [],
  deletedGeometryIds: [],
});

export async function executeMarkupCommand(
  { ctx, sessionId, actor }: CommandContext,
  command: MarkupCommand,
): Promise<MarkupOutcome> {
  const editing = markupEditingIn(ctx, sessionId);
  switch (command.kind) {
    case "edit-markup": {
      const { geometry, color, style } = command;
      await editing.editMarkup(command.markupId, actor, {
        version: command.version,
        ...(geometry === undefined ? {} : { geometry: asMarkupGeometry(geometry) }),
        ...(color === undefined ? {} : { color }),
        ...(style === undefined ? {} : { style }),
      });
      return did("markup_edit");
    }
    case "delete-markup":
      await editing.softDeleteMarkup(command.markupId, actor, command.version);
      return did("markup_delete");
    case "restore-markup":
      await editing.restoreMarkup(command.markupId, actor);
      return did("markup_restore");
    case "edit-comment":
      await editing.editComment(command.markupId, command.commentId, actor, {
        version: command.version,
        body: command.body,
        ...(command.bodyHtml === undefined ? {} : { bodyHtml: command.bodyHtml }),
      });
      return did("markup_comment_edit");
  }
}
