import type { Knex } from "knex";
import type {
  SubtaskRow,
  TaskBoardRow,
  TaskColumnRow,
  TaskLinkRow,
  TaskRow,
} from "./types.ts";

export interface NewTaskRecord {
  id: string;
  project_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  assignee_id: string | null;
  assignee_team_member_id: string | null;
  due_date: string | null;
  priority: string;
  position: number;
  source_type: string | null;
  source_id: string | null;
  created_by_id: string | null;
}

export interface TaskUpdatePatch {
  title?: string;
  description?: string | null;
  description_html?: string | null;
  assignee_id?: string | null;
  assignee_team_member_id?: string | null;
  due_date?: string | null;
  priority?: string;
  column_id?: string;
  position?: number;
  updated_at?: string;
}

export interface NewColumnRecord {
  id: string;
  board_id: string;
  name: string;
  status: string | null;
  position: number;
}

const TASK_SELECT = [
  "t.id",
  "t.project_id",
  "t.board_id",
  "t.column_id",
  "t.title",
  "t.description",
  "t.description_html",
  "t.assignee_id",
  "u.name as assignee_name",
  "t.assignee_team_member_id",
  "tm.name as assignee_team_member_name",
  "t.due_date",
  "t.priority",
  "t.position",
  "t.source_type",
  "t.source_id",
  "t.created_by_id",
  "t.created_at",
  "t.updated_at",
] as const;

export function tasksRepository(db: Knex) {
  function taskBase() {
    return db("tasks as t")
      .leftJoin("user as u", "u.id", "t.assignee_id")
      .leftJoin("team_members as tm", "tm.id", "t.assignee_team_member_id");
  }

  return {
    findDefaultBoard(projectId: string): Promise<TaskBoardRow | undefined> {
      return db<TaskBoardRow>("task_boards")
        .where({ project_id: projectId, is_default: true })
        .first();
    },

    findBoardById(boardId: string): Promise<TaskBoardRow | undefined> {
      return db<TaskBoardRow>("task_boards").where({ id: boardId }).first();
    },

    async createBoardWithColumns(
      board: { id: string; project_id: string; name: string; is_default: boolean; created_by_id: string | null },
      columns: NewColumnRecord[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("task_boards").insert(board);
        if (columns.length) await trx("task_columns").insert(columns);
      });
    },

    listColumns(boardId: string): Promise<TaskColumnRow[]> {
      return db<TaskColumnRow>("task_columns")
        .where({ board_id: boardId })
        .orderBy("position", "asc");
    },

    findColumnById(columnId: string): Promise<TaskColumnRow | undefined> {
      return db<TaskColumnRow>("task_columns").where({ id: columnId }).first();
    },

    async createColumn(record: NewColumnRecord): Promise<void> {
      await db("task_columns").insert(record);
    },

    async renameColumn(columnId: string, name: string): Promise<void> {
      await db("task_columns").where({ id: columnId }).update({ name });
    },

    async deleteColumn(columnId: string): Promise<void> {
      await db("task_columns").where({ id: columnId }).delete();
    },

    async countTasksInColumn(columnId: string): Promise<number> {
      const row = await db("tasks").where({ column_id: columnId }).count<{ count: string }>("id as count").first();
      return row ? Number(row.count) : 0;
    },

    async maxColumnPosition(boardId: string): Promise<number> {
      const row = await db("task_columns")
        .where({ board_id: boardId })
        .max<{ max: number | null }>("position as max")
        .first();
      return row?.max ?? 0;
    },

    async setColumnPositions(boardId: string, ordered: { id: string; position: number }[]): Promise<void> {
      await db.transaction(async (trx) => {
        for (const item of ordered) {
          await trx("task_columns")
            .where({ id: item.id, board_id: boardId })
            .update({ position: item.position });
        }
      });
    },

    listTasksByBoard(boardId: string): Promise<TaskRow[]> {
      return taskBase()
        .where("t.board_id", boardId)
        .select(...TASK_SELECT)
        .orderBy([
          { column: "t.column_id", order: "asc" },
          { column: "t.position", order: "asc" },
        ]);
    },

    findTaskById(id: string): Promise<TaskRow | undefined> {
      return taskBase().where("t.id", id).select(...TASK_SELECT).first();
    },

    async maxPositionInColumn(columnId: string): Promise<number> {
      const row = await db("tasks")
        .where({ column_id: columnId })
        .max<{ max: number | null }>("position as max")
        .first();
      return row?.max ?? 0;
    },

    async createTask(record: NewTaskRecord): Promise<void> {
      await db("tasks").insert(record);
    },

    async updateTask(id: string, patch: TaskUpdatePatch): Promise<void> {
      await db("tasks")
        .where({ id })
        .update({ ...patch, updated_at: db.fn.now() });
    },

    async deleteTask(id: string): Promise<void> {
      await db("tasks").where({ id }).delete();
    },

    async teamMemberInProject(teamMemberId: string, projectId: string): Promise<boolean> {
      const row = await db("team_members").where({ id: teamMemberId, project_id: projectId }).first();
      return Boolean(row);
    },

    async subtaskCounts(taskIds: string[]): Promise<Map<string, { total: number; done: number }>> {
      const result = new Map<string, { total: number; done: number }>();
      if (taskIds.length === 0) return result;
      const rows = await db("task_subtasks")
        .whereIn("task_id", taskIds)
        .select("task_id")
        .select(db.raw("count(*)::int as total"))
        .select(db.raw("count(*) filter (where done)::int as done"))
        .groupBy("task_id");
      for (const row of rows as unknown as { task_id: string; total: number; done: number }[]) {
        result.set(row.task_id, { total: Number(row.total), done: Number(row.done) });
      }
      return result;
    },

    listSubtasks(taskId: string): Promise<SubtaskRow[]> {
      return db<SubtaskRow>("task_subtasks").where({ task_id: taskId }).orderBy("position", "asc");
    },

    findSubtaskById(id: string): Promise<SubtaskRow | undefined> {
      return db<SubtaskRow>("task_subtasks").where({ id }).first();
    },

    async maxSubtaskPosition(taskId: string): Promise<number> {
      const row = await db("task_subtasks")
        .where({ task_id: taskId })
        .max<{ max: number | null }>("position as max")
        .first();
      return row?.max ?? 0;
    },

    async createSubtask(record: { id: string; task_id: string; title: string; position: number }): Promise<void> {
      await db("task_subtasks").insert(record);
    },

    async updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<void> {
      await db("task_subtasks").where({ id }).update(patch);
    },

    async deleteSubtask(id: string): Promise<void> {
      await db("task_subtasks").where({ id }).delete();
    },

    listLinks(taskId: string): Promise<TaskLinkRow[]> {
      return db("task_links as l")
        .join("tasks as tt", "tt.id", "l.target_task_id")
        .where("l.source_task_id", taskId)
        .select(
          "l.id",
          "l.project_id",
          "l.source_task_id",
          "l.target_task_id",
          "tt.title as target_task_title",
          "l.link_type",
          "l.created_at",
        )
        .orderBy("l.created_at", "asc");
    },

    findLinkById(id: string): Promise<TaskLinkRow | undefined> {
      return db<TaskLinkRow>("task_links").where({ id }).first();
    },

    async createLink(record: {
      id: string;
      project_id: string;
      source_task_id: string;
      target_task_id: string;
      link_type: string;
      created_by_id: string | null;
    }): Promise<void> {
      await db("task_links").insert(record);
    },

    async deleteLink(id: string): Promise<void> {
      await db("task_links").where({ id }).delete();
    },
  };
}

export type TasksRepository = ReturnType<typeof tasksRepository>;
