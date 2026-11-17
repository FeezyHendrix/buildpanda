import { generateId } from "../../lib/ids.ts";
import { NotFoundError, BadRequestError } from "../../lib/errors.ts";
import type { NewColumnRecord, TasksRepository } from "./repository.ts";
import type {
  CreateTaskInput, UpdateTaskInput, MoveTaskInput, TaskAssigneeInput, AssignableUser, TasksDeps,
  Task, TaskAssignee, TaskBoard, TaskBoardRow, TaskColumnRow, TaskComment, TaskDetail,
  TaskEntityLink, TaskEntityLinkRow, TaskStatus,
} from "./types.ts";
import { toColumn, normalizeLabels, toTask, groupAssignees, toSubtask, toLink, toComment } from "./mappers.ts";
import { notifyAssignees, notifyHighPriority } from "./notifications.ts";
import { taskRelationsService } from "./relations-service.ts";
import { taskColumnsService } from "./column-service.ts";
export type { CreateTaskInput, UpdateTaskInput, MoveTaskInput, TaskAssigneeInput, AssignableUser, TasksDeps } from "./types.ts";

const DEFAULT_COLUMNS: ReadonlyArray<{ name: string; status: TaskStatus }> = [
  { name: "To Do", status: "Todo" },
  { name: "Doing", status: "Doing" },
  { name: "Done", status: "Done" },
];

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
      buildingId?: string,
    ): Promise<TaskBoard> {
      const board = await ensureDefaultBoard(projectId, userId, buildingId);
      return assembleBoard(board, assigneeId);
    },

    async getExistingBoard(projectId: string, buildingId?: string): Promise<TaskBoard | null> {
      const resolved = await resolveBuildingId(projectId, buildingId);
      const board = await repository.findDefaultBoard(projectId, resolved);
      return board ? assembleBoard(board) : null;
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

    ...taskColumnsService(repository, ensureDefaultBoard, assertColumnInProject),
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

    ...taskRelationsService(repository, resolveEntityLinks),
  };
}

export type TasksService = ReturnType<typeof tasksService>;
