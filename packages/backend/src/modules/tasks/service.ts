import { generateId } from "../../lib/ids.ts";
import { NotFoundError, BadRequestError } from "../../lib/errors.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { NewColumnRecord, TasksRepository } from "./repository.ts";
import type {
  Subtask,
  SubtaskRow,
  Task,
  TaskBoard,
  TaskBoardRow,
  TaskColumn,
  TaskColumnRow,
  TaskDetail,
  TaskLink,
  TaskLinkRow,
  TaskRow,
  TaskStatus,
} from "./types.ts";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  dueDate?: string | null;
  columnId?: string | null;
  status?: TaskStatus;
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  dueDate?: string | null;
}

export interface MoveTaskInput {
  columnId: string;
  position: number;
}

export interface TasksDeps {
  notifications?: NotificationsService;
}

const DEFAULT_COLUMNS: ReadonlyArray<{ name: string; status: TaskStatus }> = [
  { name: "To Do", status: "Todo" },
  { name: "Doing", status: "Doing" },
  { name: "Done", status: "Done" },
];

function toColumn(row: TaskColumnRow): TaskColumn {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    status: row.status,
    position: row.position,
  };
}

function toTask(row: TaskRow, counts?: { total: number; done: number }): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    assigneeTeamMemberId: row.assignee_team_member_id,
    assigneeName: row.assignee_name ?? row.assignee_team_member_name,
    dueDate: row.due_date,
    position: row.position,
    sourceType: row.source_type,
    sourceId: row.source_id,
    subtaskTotal: counts?.total ?? 0,
    subtaskDone: counts?.done ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSubtask(row: SubtaskRow): Subtask {
  return { id: row.id, taskId: row.task_id, title: row.title, done: row.done, position: row.position };
}

function toLink(row: TaskLinkRow): TaskLink {
  return {
    id: row.id,
    linkType: row.link_type,
    targetTaskId: row.target_task_id,
    targetTaskTitle: row.target_task_title,
  };
}

function notifyAssignee(
  deps: TasksDeps,
  row: TaskRow,
  actorId: string | null,
): void {
  if (!deps.notifications || !row.assignee_id || row.assignee_id === actorId) return;
  void deps.notifications
    .notify(row.assignee_id, "task_assigned", {
      title: "A task was assigned to you",
      body: row.title,
      projectId: row.project_id,
    })
    .catch(() => undefined);
}

export function tasksService(repository: TasksRepository, deps: TasksDeps = {}) {
  async function ensureDefaultBoard(projectId: string, userId: string | null): Promise<TaskBoardRow> {
    const existing = await repository.findDefaultBoard(projectId);
    if (existing) return existing;

    const boardId = generateId("board");
    const columns: NewColumnRecord[] = DEFAULT_COLUMNS.map((col, index) => ({
      id: generateId("tcol"),
      board_id: boardId,
      name: col.name,
      status: col.status,
      position: index,
    }));
    await repository.createBoardWithColumns(
      { id: boardId, project_id: projectId, name: "Tasks", is_default: true, created_by_id: userId },
      columns,
    );
    const created = await repository.findBoardById(boardId);
    if (!created) throw new NotFoundError("Task board");
    return created;
  }

  async function assembleBoard(boardRow: TaskBoardRow): Promise<TaskBoard> {
    const [columns, tasks] = await Promise.all([
      repository.listColumns(boardRow.id),
      repository.listTasksByBoard(boardRow.id),
    ]);
    const counts = await repository.subtaskCounts(tasks.map((t) => t.id));
    return {
      id: boardRow.id,
      projectId: boardRow.project_id,
      name: boardRow.name,
      isDefault: boardRow.is_default,
      columns: columns.map(toColumn),
      tasks: tasks.map((t) => toTask(t, counts.get(t.id))),
    };
  }

  async function assertColumnInProject(projectId: string, columnId: string): Promise<TaskColumnRow> {
    const column = await repository.findColumnById(columnId);
    if (!column) throw new NotFoundError("Task column");
    const board = await repository.findBoardById(column.board_id);
    if (!board || board.project_id !== projectId) throw new NotFoundError("Task column");
    return column;
  }

  async function resolveAssignee(
    projectId: string,
    assigneeId: string | null | undefined,
    assigneeTeamMemberId: string | null | undefined,
  ): Promise<{ assignee_id: string | null; assignee_team_member_id: string | null }> {
    if (assigneeId && assigneeTeamMemberId) {
      throw new BadRequestError("A task can be assigned to a user or a team member, not both");
    }
    if (assigneeTeamMemberId) {
      const ok = await repository.teamMemberInProject(assigneeTeamMemberId, projectId);
      if (!ok) throw new BadRequestError("Unknown team member for this project");
      return { assignee_id: null, assignee_team_member_id: assigneeTeamMemberId };
    }
    return { assignee_id: assigneeId ?? null, assignee_team_member_id: null };
  }

  return {
    async getDefaultBoard(projectId: string, userId: string | null): Promise<TaskBoard> {
      const board = await ensureDefaultBoard(projectId, userId);
      return assembleBoard(board);
    },

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

    async createTask(projectId: string, input: CreateTaskInput, userId: string | null): Promise<Task> {
      const board = await ensureDefaultBoard(projectId, userId);
      const columns = await repository.listColumns(board.id);

      let column: TaskColumnRow | undefined;
      if (input.columnId) {
        column = columns.find((c) => c.id === input.columnId);
        if (!column) throw new BadRequestError("Unknown column for this board");
      } else if (input.status) {
        column = columns.find((c) => c.status === input.status);
      }
      column = column ?? columns[0];
      if (!column) throw new NotFoundError("Task column");

      const maxPosition = await repository.maxPositionInColumn(column.id);
      const assignee = await resolveAssignee(projectId, input.assigneeId, input.assigneeTeamMemberId);
      const id = generateId("task");
      await repository.createTask({
        id,
        project_id: projectId,
        board_id: board.id,
        column_id: column.id,
        title: input.title,
        description: input.description ?? null,
        assignee_id: assignee.assignee_id,
        assignee_team_member_id: assignee.assignee_team_member_id,
        due_date: input.dueDate ?? null,
        position: maxPosition + 1000,
        source_type: input.sourceType ?? null,
        source_id: input.sourceId ?? null,
        created_by_id: userId,
      });

      const row = await repository.findTaskById(id);
      if (!row) throw new NotFoundError("Task");
      notifyAssignee(deps, row, userId);
      return toTask(row);
    },

    async updateTask(
      projectId: string,
      taskId: string,
      input: UpdateTaskInput,
      actorId: string | null,
    ): Promise<Task> {
      const existing = await repository.findTaskById(taskId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Task");

      const assigneeProvided =
        input.assigneeId !== undefined || input.assigneeTeamMemberId !== undefined;
      const assignee = assigneeProvided
        ? await resolveAssignee(projectId, input.assigneeId, input.assigneeTeamMemberId)
        : null;
      const userAssigneeChanged =
        assignee !== null && assignee.assignee_id !== existing.assignee_id && assignee.assignee_id !== null;

      await repository.updateTask(taskId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(assignee !== null
          ? { assignee_id: assignee.assignee_id, assignee_team_member_id: assignee.assignee_team_member_id }
          : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      });

      const row = await repository.findTaskById(taskId);
      if (!row) throw new NotFoundError("Task");
      if (userAssigneeChanged) notifyAssignee(deps, row, actorId);
      return toTask(row);
    },

    async moveTask(projectId: string, taskId: string, input: MoveTaskInput): Promise<Task> {
      const existing = await repository.findTaskById(taskId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Task");

      const column = await repository.findColumnById(input.columnId);
      if (!column || column.board_id !== existing.board_id) {
        throw new BadRequestError("Unknown column for this board");
      }

      await repository.updateTask(taskId, {
        column_id: input.columnId,
        position: input.position,
      });
      const row = await repository.findTaskById(taskId);
      if (!row) throw new NotFoundError("Task");
      return toTask(row);
    },

    async removeTask(projectId: string, taskId: string): Promise<void> {
      const existing = await repository.findTaskById(taskId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Task");
      await repository.deleteTask(taskId);
    },

    async getTaskDetail(projectId: string, taskId: string): Promise<TaskDetail> {
      const row = await repository.findTaskById(taskId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Task");
      const [subtaskRows, linkRows, counts] = await Promise.all([
        repository.listSubtasks(taskId),
        repository.listLinks(taskId),
        repository.subtaskCounts([taskId]),
      ]);
      return {
        ...toTask(row, counts.get(taskId)),
        subtasks: subtaskRows.map(toSubtask),
        links: linkRows.map(toLink),
      };
    },

    async addSubtask(projectId: string, taskId: string, title: string): Promise<Subtask> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const maxPosition = await repository.maxSubtaskPosition(taskId);
      const id = generateId("subtask");
      await repository.createSubtask({ id, task_id: taskId, title, position: maxPosition + 1 });
      const created = await repository.findSubtaskById(id);
      if (!created) throw new NotFoundError("Subtask");
      return toSubtask(created);
    },

    async updateSubtask(
      projectId: string,
      taskId: string,
      subtaskId: string,
      patch: { title?: string; done?: boolean },
    ): Promise<Subtask> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const subtask = await repository.findSubtaskById(subtaskId);
      if (!subtask || subtask.task_id !== taskId) throw new NotFoundError("Subtask");
      await repository.updateSubtask(subtaskId, patch);
      const updated = await repository.findSubtaskById(subtaskId);
      if (!updated) throw new NotFoundError("Subtask");
      return toSubtask(updated);
    },

    async removeSubtask(projectId: string, taskId: string, subtaskId: string): Promise<void> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const subtask = await repository.findSubtaskById(subtaskId);
      if (!subtask || subtask.task_id !== taskId) throw new NotFoundError("Subtask");
      await repository.deleteSubtask(subtaskId);
    },

    async addLink(
      projectId: string,
      taskId: string,
      targetTaskId: string,
      linkType: string,
      userId: string | null,
    ): Promise<TaskLink> {
      if (taskId === targetTaskId) throw new BadRequestError("A task cannot be linked to itself");
      const [task, target] = await Promise.all([
        repository.findTaskById(taskId),
        repository.findTaskById(targetTaskId),
      ]);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      if (!target || target.project_id !== projectId) throw new BadRequestError("Linked task must be in the same project");
      const id = generateId("tlink");
      await repository.createLink({
        id,
        project_id: projectId,
        source_task_id: taskId,
        target_task_id: targetTaskId,
        link_type: linkType,
        created_by_id: userId,
      });
      const created = await repository.findLinkById(id);
      const links = await repository.listLinks(taskId);
      const found = links.find((l) => l.id === id);
      if (!found || !created) throw new NotFoundError("Task link");
      return toLink(found);
    },

    async removeLink(projectId: string, taskId: string, linkId: string): Promise<void> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const link = await repository.findLinkById(linkId);
      if (!link || link.source_task_id !== taskId) throw new NotFoundError("Task link");
      await repository.deleteLink(linkId);
    },
  };
}

export type TasksService = ReturnType<typeof tasksService>;
