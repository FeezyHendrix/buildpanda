import { generateId } from "../../lib/ids.ts";
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { NewColumnRecord, TasksRepository } from "./repository.ts";
import type {
  Subtask,
  SubtaskRow,
  Task,
  TaskAssignee,
  TaskAssigneeRow,
  TaskBoard,
  TaskBoardRow,
  TaskColumn,
  TaskColumnRow,
  TaskComment,
  TaskCommentRow,
  TaskDetail,
  TaskEntityLink,
  TaskEntityLinkRow,
  TaskEntityType,
  TaskLink,
  TaskLinkRow,
  TaskRow,
  TaskStatus,
  TaskPriority,
} from "./types.ts";

export interface CreateTaskInput {
  title: string;
  buildingId?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  assignees?: TaskAssigneeInput[];
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
  columnId?: string | null;
  status?: TaskStatus;
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  assignees?: TaskAssigneeInput[];
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
}

export interface TaskAssigneeInput {
  kind: "user" | "team";
  id: string;
}

export interface MoveTaskInput {
  columnId: string;
  position: number;
}

export interface AssignableUser {
  kind: "user" | "team";
  id: string;
  name: string;
  email: string | null;
  isSelf: boolean;
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

function parseLabels(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().slice(0, 40);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 20) break;
  }
  return out;
}

function toTask(
  row: TaskRow,
  assignees: TaskAssignee[] = [],
  counts?: { total: number; done: number },
  entityLinkTypes?: TaskEntityType[],
): Task {
  const firstAssignee = assignees[0] ?? null;
  return {
    id: row.id,
    projectId: row.project_id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
    assigneeId: row.assignee_id,
    assigneeTeamMemberId: row.assignee_team_member_id,
    assigneeName: firstAssignee?.name ?? null,
    assignees,
    dueDate: row.due_date,
    priority: row.priority,
    labels: parseLabels(row.labels),
    position: row.position,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    subtaskTotal: counts?.total ?? 0,
    subtaskDone: counts?.done ?? 0,
    entityLinkTypes: entityLinkTypes ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function groupAssignees(rows: TaskAssigneeRow[]): Map<string, TaskAssignee[]> {
  const grouped = new Map<string, TaskAssignee[]>();
  for (const row of rows) {
    const assignee = row.assignee_id
      ? { kind: "user" as const, id: row.assignee_id, name: row.assignee_name ?? "Unknown user" }
      : row.assignee_team_member_id
        ? { kind: "team" as const, id: row.assignee_team_member_id, name: row.assignee_team_member_name ?? "Unknown team member" }
        : null;
    if (!assignee) continue;
    const list = grouped.get(row.task_id) ?? [];
    list.push(assignee);
    grouped.set(row.task_id, list);
  }
  return grouped;
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

function toComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function notifyAssignees(
  deps: TasksDeps,
  row: TaskRow,
  assignees: TaskAssignee[],
  actorId: string | null,
): void {
  if (!deps.notifications) return;
  for (const assignee of assignees) {
    if (assignee.kind !== "user" || assignee.id === actorId) continue;
    void deps.notifications
      .notify(assignee.id, "task_assigned", {
        title: "A task was assigned to you",
        body: row.title,
        projectId: row.project_id,
      })
      .catch(() => undefined);
  }
}

function notifyHighPriority(
  deps: TasksDeps,
  row: TaskRow,
  assignees: TaskAssignee[],
  actorId: string | null,
): void {
  if (!deps.notifications || row.priority !== "High") return;
  for (const assignee of assignees) {
    if (assignee.kind !== "user" || assignee.id === actorId) continue;
    void deps.notifications
      .notify(assignee.id, "task_high_priority", {
        title: "A high-priority task needs your attention",
        body: row.title,
        projectId: row.project_id,
      })
      .catch(() => undefined);
  }
}

export function tasksService(
  repository: TasksRepository,
  deps: TasksDeps = {},
  soleRealBuildingId: (projectId: string) => Promise<string | undefined> = async () => undefined,
) {
  async function resolveBuildingId(projectId: string, explicit?: string | null): Promise<string> {
    if (explicit) return explicit;
    const buildingId = await soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  }

  async function ensureDefaultBoard(
    projectId: string,
    userId: string | null,
    explicitBuildingId?: string | null,
  ): Promise<TaskBoardRow> {
    const buildingId = await resolveBuildingId(projectId, explicitBuildingId);
    const existing = await repository.findDefaultBoard(projectId, buildingId);
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
      { id: boardId, project_id: projectId, building_id: buildingId, name: "Tasks", is_default: true, created_by_id: userId },
      columns,
    );
    const created = await repository.findBoardById(boardId);
    if (!created) throw new NotFoundError("Task board");
    return created;
  }

  async function assembleBoard(
    boardRow: TaskBoardRow,
    assigneeId?: string,
  ): Promise<TaskBoard> {
    const [columns, allTasks] = await Promise.all([
      repository.listColumns(boardRow.id),
      repository.listTasksByBoard(boardRow.id),
    ]);
    const allTaskIds = allTasks.map((t) => t.id);
    const assigneesByTask = groupAssignees(await repository.listAssigneesByTaskIds(allTaskIds));
    const tasks = assigneeId
      ? allTasks.filter((task) => assigneesByTask.get(task.id)?.some((assignee) => assignee.kind === "user" && assignee.id === assigneeId))
      : allTasks;
    const taskIds = tasks.map((t) => t.id);
    const [counts, linkTypes] = await Promise.all([
      repository.subtaskCounts(taskIds),
      repository.entityLinkTypesByTask(taskIds),
    ]);
    return {
      id: boardRow.id,
      projectId: boardRow.project_id,
      name: boardRow.name,
      isDefault: boardRow.is_default,
      scope: assigneeId ? "assigned" : "all",
      columns: columns.map(toColumn),
      tasks: tasks.map((t) => toTask(t, assigneesByTask.get(t.id) ?? [], counts.get(t.id), linkTypes.get(t.id))),
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

  async function resolveAssignees(
    projectId: string,
    input: {
      assignees?: TaskAssigneeInput[];
      assigneeId?: string | null;
      assigneeTeamMemberId?: string | null;
    },
  ): Promise<{ assignee_id: string | null; assignee_team_member_id: string | null }[]> {
    const rawAssignees = input.assignees;
    if (rawAssignees !== undefined) {
      const seen = new Set<string>();
      const resolved: { assignee_id: string | null; assignee_team_member_id: string | null }[] = [];
      for (const assignee of rawAssignees) {
        const key = `${assignee.kind}:${assignee.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (assignee.kind === "team") {
          const ok = await repository.teamMemberInProject(assignee.id, projectId);
          if (!ok) throw new BadRequestError("Unknown team member for this project");
          resolved.push({ assignee_id: null, assignee_team_member_id: assignee.id });
        } else {
          resolved.push({ assignee_id: assignee.id, assignee_team_member_id: null });
        }
      }
      return resolved;
    }
    const assignee = await resolveAssignee(projectId, input.assigneeId, input.assigneeTeamMemberId);
    return assignee.assignee_id || assignee.assignee_team_member_id ? [assignee] : [];
  }

  async function taskAssignees(taskId: string): Promise<TaskAssignee[]> {
    return groupAssignees(await repository.listAssigneesByTaskIds([taskId])).get(taskId) ?? [];
  }

  async function resolveEntityLinks(rows: TaskEntityLinkRow[]): Promise<TaskEntityLink[]> {
    if (rows.length === 0) return [];
    const labels = await repository.resolveEntityLabels(rows);
    return rows.map((row) => {
      const resolved = labels.get(`${row.entity_type}:${row.entity_id}`);
      return {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        label: resolved?.label ?? "(deleted)",
        status: resolved?.status ?? null,
      };
    });
  }

  return {
    async getDefaultBoard(
      projectId: string,
      userId: string | null,
      assigneeId?: string,
    ): Promise<TaskBoard> {
      const board = await ensureDefaultBoard(projectId, userId);
      return assembleBoard(board, assigneeId);
    },

    async isTaskAssignedToUser(projectId: string, taskId: string, userId: string): Promise<boolean> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      return repository.taskAssignedToUser(projectId, taskId, userId);
    },

    async listAssignable(
      projectId: string,
      organizationId: string | null,
      ownerId: string | null,
      currentUserId: string,
    ): Promise<AssignableUser[]> {
      const [users, teams] = await Promise.all([
        repository.assignableUsers(projectId, organizationId, ownerId),
        repository.teamAssignees(projectId),
      ]);
      const seen = new Set<string>();
      const result: AssignableUser[] = [];
      for (const u of users) {
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        result.push({
          kind: "user",
          id: u.id,
          name: u.name,
          email: u.email,
          isSelf: u.id === currentUserId,
        });
      }
      for (const t of teams) {
        result.push({ kind: "team", id: t.id, name: t.name, email: null, isSelf: false });
      }
      result.sort((a, b) => {
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return result;
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
      const board = await ensureDefaultBoard(projectId, userId, input.buildingId);
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
      const assignees = await resolveAssignees(projectId, input);
      const primaryAssignee = assignees[0] ?? { assignee_id: null, assignee_team_member_id: null };
      const id = generateId("task");
      await repository.createTask({
        id,
        project_id: projectId,
        building_id: board.building_id,
        board_id: board.id,
        column_id: column.id,
        title: input.title,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        assignee_id: primaryAssignee.assignee_id,
        assignee_team_member_id: primaryAssignee.assignee_team_member_id,
        due_date: input.dueDate ?? null,
        priority: input.priority ?? "Medium",
        labels: JSON.stringify(normalizeLabels(input.labels ?? [])),
        position: maxPosition + 1000,
        source_type: input.sourceType ?? null,
        source_id: input.sourceId ?? null,
        created_by_id: userId,
      });
      await repository.replaceTaskAssignees(id, assignees);

      const row = await repository.findTaskById(id);
      if (!row) throw new NotFoundError("Task");
      const savedAssignees = await taskAssignees(id);
      notifyAssignees(deps, row, savedAssignees, userId);
      notifyHighPriority(deps, row, savedAssignees, userId);
      return toTask(row, savedAssignees);
    },

    async updateTask(
      projectId: string,
      taskId: string,
      input: UpdateTaskInput,
      actorId: string | null,
    ): Promise<Task> {
      const existing = await repository.findTaskById(taskId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Task");

      const assigneeProvided = input.assignees !== undefined || input.assigneeId !== undefined || input.assigneeTeamMemberId !== undefined;
      const existingAssignees = await taskAssignees(taskId);
      const assignees = assigneeProvided ? await resolveAssignees(projectId, input) : null;
      const primaryAssignee = assignees?.[0] ?? { assignee_id: null, assignee_team_member_id: null };
      const existingUserIds = new Set(existingAssignees.filter((assignee) => assignee.kind === "user").map((assignee) => assignee.id));
      const newlyAssignedUserIds = (assignees ?? [])
        .filter((assignee) => assignee.assignee_id && !existingUserIds.has(assignee.assignee_id))
        .map((assignee) => assignee.assignee_id!);

      await repository.updateTask(taskId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.descriptionHtml !== undefined ? { description_html: input.descriptionHtml } : {}),
        ...(assignees !== null
          ? { assignee_id: primaryAssignee.assignee_id, assignee_team_member_id: primaryAssignee.assignee_team_member_id }
          : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.labels !== undefined ? { labels: JSON.stringify(normalizeLabels(input.labels)) } : {}),
      });
      if (assignees !== null) await repository.replaceTaskAssignees(taskId, assignees);

      const row = await repository.findTaskById(taskId);
      if (!row) throw new NotFoundError("Task");
      const savedAssignees = await taskAssignees(taskId);
      if (newlyAssignedUserIds.length > 0) {
        notifyAssignees(
          deps,
          row,
          savedAssignees.filter((assignee) => assignee.kind === "user" && newlyAssignedUserIds.includes(assignee.id)),
          actorId,
        );
      }
      // Fire only on the transition INTO High (or when a High task is reassigned),
      // so re-saving an already-High task doesn't re-spam the assignee.
      const becameHigh = row.priority === "High" && existing.priority !== "High";
      if (becameHigh) {
        notifyHighPriority(deps, row, savedAssignees, actorId);
      } else if (row.priority === "High" && newlyAssignedUserIds.length > 0) {
        notifyHighPriority(
          deps,
          row,
          savedAssignees.filter((assignee) => assignee.kind === "user" && newlyAssignedUserIds.includes(assignee.id)),
          actorId,
        );
      }
      return toTask(row, savedAssignees);
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
      return toTask(row, await taskAssignees(taskId));
    },

    async removeTask(projectId: string, taskId: string): Promise<void> {
      const existing = await repository.findTaskById(taskId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Task");
      await repository.deleteTask(taskId);
    },

    async getTaskDetail(projectId: string, taskId: string): Promise<TaskDetail> {
      const row = await repository.findTaskById(taskId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Task");
      const [subtaskRows, linkRows, entityLinkRows, commentRows, counts] = await Promise.all([
        repository.listSubtasks(taskId),
        repository.listLinks(taskId),
        repository.listEntityLinks(taskId),
        repository.listComments(taskId),
        repository.subtaskCounts([taskId]),
      ]);
      return {
        ...toTask(row, await taskAssignees(taskId), counts.get(taskId)),
        subtasks: subtaskRows.map(toSubtask),
        links: linkRows.map(toLink),
        entityLinks: await resolveEntityLinks(entityLinkRows),
        comments: commentRows.map(toComment),
      };
    },

    async listComments(projectId: string, taskId: string): Promise<TaskComment[]> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const rows = await repository.listComments(taskId);
      return rows.map(toComment);
    },

    async addComment(
      projectId: string,
      taskId: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<TaskComment> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const row = await repository.addComment({
        id: generateId("tc"),
        task_id: taskId,
        author_id: author.id,
        author_name: author.name,
        body,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
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

    async addEntityLink(
      projectId: string,
      taskId: string,
      entityType: TaskEntityType,
      entityId: string,
      userId: string | null,
    ): Promise<TaskEntityLink> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const exists = await repository.entityExists(entityType, entityId, projectId);
      if (!exists) throw new BadRequestError("Linked item must belong to this project");
      const alreadyLinked = await repository.entityLinkExists(taskId, entityType, entityId);
      if (alreadyLinked) throw new ConflictError("This item is already linked to the task");
      const id = generateId("telink");
      await repository.createEntityLink({
        id,
        project_id: projectId,
        task_id: taskId,
        entity_type: entityType,
        entity_id: entityId,
        created_by_id: userId,
      });
      const created = await repository.findEntityLinkById(id);
      if (!created) throw new NotFoundError("Task link");
      const [link] = await resolveEntityLinks([created]);
      if (!link) throw new NotFoundError("Task link");
      return link;
    },

    async removeEntityLink(projectId: string, taskId: string, linkId: string): Promise<void> {
      const task = await repository.findTaskById(taskId);
      if (!task || task.project_id !== projectId) throw new NotFoundError("Task");
      const link = await repository.findEntityLinkById(linkId);
      if (!link || link.task_id !== taskId) throw new NotFoundError("Task link");
      await repository.deleteEntityLink(linkId);
    },
  };
}

export type TasksService = ReturnType<typeof tasksService>;
