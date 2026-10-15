import { AccessDeniedError } from "@/lib/project-access-store";
import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { and, asc, eq, notInArray } from "drizzle-orm";
import type { CreateTaskInput, Task, TaskAssignee, TaskBoard } from "@/api/tasks";
import type { Db } from "./client";
import { enqueueUpdate } from "./enqueue-update";
import { taskColumns, tasks, outbox, type TaskRow } from "./schema";
import { remapQueuedRecord } from "./sync-write-state";
import { taskReadWhere } from "./record-visibility";

const access = repositoryAccess(features.tasks);

export interface LocalTaskInput {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: Task["priority"];
  assignees: TaskAssignee[];
}

export function parseAssignees(raw: string): TaskAssignee[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TaskAssignee[]) : [];
  } catch {
    return [];
  }
}

function serverValues(projectId: string, buildingId: string, task: Task, selfId: string | null) {
  return {
    projectId,
    buildingId,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    descriptionHtml: task.descriptionHtml ?? null,
    dueDate: task.dueDate,
    priority: task.priority,
    assignees: JSON.stringify(task.assignees ?? []),
    assignedToMe: Boolean(selfId && task.assignees?.some((a) => a.kind === "user" && a.id === selfId)),
    position: task.position,
    subtaskTotal: task.subtaskTotal ?? 0,
    subtaskDone: task.subtaskDone ?? 0,
    createdById: task.createdById ?? null,
    createdByName: task.createdByName,
  };
}

/** The end of a column: tasks moved or added on the phone go to the bottom. */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function endOf(tx: Tx, columnId: string): number {
  const rows = tx.select({ position: tasks.position }).from(tasks).where(eq(tasks.columnId, columnId)).all();
  return rows.reduce((max, row) => Math.max(max, row.position), 0) + 1000;
}

export const tasksRepository = {
  columnsQuery: (db: Db, projectId: string, buildingId: string) =>
    db.select().from(taskColumns)
      .where(access.where(db, taskColumns.projectId, and(eq(taskColumns.projectId, projectId), eq(taskColumns.buildingId, buildingId))))
      .orderBy(asc(taskColumns.position)),

  tasksQuery: (db: Db, projectId: string, buildingId: string) =>
    db.select().from(tasks)
      .where(access.where(db, tasks.projectId, taskReadWhere(), and(eq(tasks.projectId, projectId), eq(tasks.buildingId, buildingId))))
      .orderBy(asc(tasks.position)),

  byIdQuery: (db: Db, id: string) => db.select().from(tasks).where(access.where(db, tasks.projectId, taskReadWhere(), eq(tasks.id, id))).limit(1),

  findById: async (db: Db, id: string): Promise<TaskRow | undefined> => {
    const [row] = await db.select().from(tasks).where(access.where(db, tasks.projectId, taskReadWhere(), eq(tasks.id, id))).limit(1);
    return row;
  },

  /** New tasks start in the To do column, or the board's first one. */
  async createLocal(db: Db, projectId: string, buildingId: string, input: LocalTaskInput, selfId: string | null): Promise<string> {
    const ticket = access.require(db, projectId, "create");
    const columns = await db.select().from(taskColumns)
      .where(access.where(db, taskColumns.projectId, and(eq(taskColumns.projectId, projectId), eq(taskColumns.buildingId, buildingId))))
      .orderBy(asc(taskColumns.position));
    const column = columns.find((c) => c.status === "Todo") ?? columns[0];
    if (!column) throw new Error("This building's task board hasn't downloaded yet. Connect once, then try again.");
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, "create", (tx) => {
      tx.insert(tasks).values({
        id,
        projectId,
        buildingId,
        columnId: column.id,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        priority: input.priority,
        createdById: ticket.scope!.userId,
        assignees: JSON.stringify(input.assignees),
        assignedToMe: input.assignees.some((a) => a.kind === "user" && a.id === ticket.scope!.userId),
        position: endOf(tx, column.id),
        isPendingSync: true,
        updatedAt: Date.now(),
      }).run();
      tx.insert(outbox).values({ id: randomUUID(), resource: "tasks", entityId: id, projectId, operation: "create", nextAttemptAt: 0 }).run();
    });
    return id;
  },

  /** A status change is a move to another column; queued as the task's update. */
  async moveLocal(db: Db, projectId: string, id: string, columnId: string): Promise<void> {
    const task = access.record(db, tasks, id, projectId);
    if (!await this.findById(db, id)) throw new AccessDeniedError();
    const column = access.record(db, taskColumns, columnId, projectId);
    if (task.buildingId !== column.buildingId) throw new Error("Choose a column in this task's building.");
    await access.transaction(db, projectId, "move", (tx) => {
      tx.update(tasks).set({ columnId, position: endOf(tx, columnId), isPendingSync: true, updatedAt: Date.now() })
        .where(access.where(db, tasks.projectId, taskReadWhere(), eq(tasks.id, id))).run();
      enqueueUpdate(tx, "tasks", id, projectId, randomUUID());
    });
  },

  toCreateInput: (row: TaskRow): CreateTaskInput => ({
    title: row.title,
    buildingId: row.buildingId,
    description: row.description,
    dueDate: row.dueDate,
    priority: row.priority as Task["priority"],
    assignees: parseAssignees(row.assignees).map(({ kind, id }) => ({ kind, id })),
    columnId: row.columnId,
  }),

  async reconcileCreate(db: Db, row: TaskRow, server: Task, selfId: string | null) {
    await access.transaction(db, row.projectId, "read", (tx) => {
      const hasEdits = remapQueuedRecord(tx, "tasks", row.id, server.id);
      tx.delete(tasks).where(access.where(db, tasks.projectId, taskReadWhere(), eq(tasks.id, row.id))).run();
      const values = {
        ...serverValues(row.projectId, row.buildingId, server, selfId),
        // a move made while the create was in flight is still to be sent
        ...(hasEdits ? { columnId: row.columnId, position: row.position } : {}),
        isPendingSync: hasEdits,
        updatedAt: Date.now(),
      };
      tx.insert(tasks).values({ id: server.id, ...values })
        .onConflictDoUpdate({ target: tasks.id, set: values, where: eq(tasks.isPendingSync, false) }).run();
    });
  },

  /** Replaces the board for one building, never touching a task still waiting to send. */
  async replaceBoard(db: Db, projectId: string, buildingId: string, board: TaskBoard, selfId: string | null) {
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      tx.delete(taskColumns).where(access.where(db, taskColumns.projectId, and(eq(taskColumns.projectId, projectId), eq(taskColumns.buildingId, buildingId)))).run();
      for (const column of board.columns) {
        tx.insert(taskColumns).values({ id: column.id, projectId, buildingId, name: column.name, status: column.status, position: column.position })
          .onConflictDoUpdate({ target: taskColumns.id, set: { projectId, buildingId, name: column.name, status: column.status, position: column.position } }).run();
      }
      const ids = board.tasks.map((t) => t.id);
      tx.delete(tasks).where(access.where(db, tasks.projectId, and(
        eq(tasks.projectId, projectId),
        eq(tasks.buildingId, buildingId),
        eq(tasks.isPendingSync, false),
        ...(ids.length ? [notInArray(tasks.id, ids)] : []),
      ))).run();
      for (const task of board.tasks) {
        const values = { ...serverValues(projectId, buildingId, task, selfId), updatedAt: now };
        tx.insert(tasks).values({ id: task.id, ...values, isPendingSync: false })
          .onConflictDoUpdate({ target: tasks.id, set: values, where: eq(tasks.isPendingSync, false) }).run();
      }
    });
  },
};
