import { generateId } from "../../lib/ids.ts";
import { NotFoundError, BadRequestError } from "../../lib/errors.ts";
import type { TasksRepository } from "./repository.ts";
import type { TaskColumn, TaskBoardRow, TaskColumnRow } from "./types.ts";
import { toColumn } from "./mappers.ts";
export function taskColumnsService(repository: TasksRepository, ensureDefaultBoard: (projectId: string, userId: string | null) => Promise<TaskBoardRow>, assertColumnInProject: (projectId: string, columnId: string) => Promise<TaskColumnRow>) {
  return {
    async addColumn(projectId: string, name: string, userId: string | null): Promise<TaskColumn> {
      const board = await ensureDefaultBoard(projectId, userId);
      const maxPosition = await repository.maxColumnPosition(board.id);
      const id = generateId("tcol");
      await repository.createColumn({
        id,
        board_id: board.id,
        name,
        status: null,
        position: maxPosition + 1,
      });
      const created = await repository.findColumnById(id);
      if (!created) throw new NotFoundError("Task column");
      return toColumn(created);
    },

    async renameColumn(projectId: string, columnId: string, name: string): Promise<TaskColumn> {
      const column = await assertColumnInProject(projectId, columnId);
      await repository.renameColumn(column.id, name);
      const updated = await repository.findColumnById(column.id);
      if (!updated) throw new NotFoundError("Task column");
      return toColumn(updated);
    },

    async deleteColumn(projectId: string, columnId: string): Promise<void> {
      const column = await assertColumnInProject(projectId, columnId);
      const columns = await repository.listColumns(column.board_id);
      if (columns.length <= 1) {
        throw new BadRequestError("A board must have at least one column");
      }
      const taskCount = await repository.countTasksInColumn(column.id);
      if (taskCount > 0) {
        throw new BadRequestError("Move or delete the tasks in this column before deleting it");
      }
      await repository.deleteColumn(column.id);
    },

    async reorderColumns(projectId: string, orderedColumnIds: string[]): Promise<TaskColumn[]> {
      const board = await ensureDefaultBoard(projectId, null);
      const columns = await repository.listColumns(board.id);
      const known = new Set(columns.map((c) => c.id));
      if (orderedColumnIds.length !== columns.length || orderedColumnIds.some((id) => !known.has(id))) {
        throw new BadRequestError("Ordered columns must match the board's columns exactly");
      }
      await repository.setColumnPositions(
        board.id,
        orderedColumnIds.map((id, index) => ({ id, position: index })),
      );
      const next = await repository.listColumns(board.id);
      return next.map(toColumn);
    },

  };
}
