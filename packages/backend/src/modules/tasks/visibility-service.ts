import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { TaskBoard, TaskDetail } from "./types.ts";
import type { TaskVisibilityRepository } from "./visibility-repository.ts";

export function taskVisibilityService(repository: TaskVisibilityRepository) {
  return {
    async requireVisible(projectId: string, taskId: string, userId?: string) {
      if (!(await repository.visibleIds(projectId, [taskId])).length) throw new NotFoundError("Task");
      if (userId && !(await repository.visibleIds(projectId, [taskId], userId)).length) {
        throw new ForbiddenError("You can only access tasks you created or are assigned to.");
      }
    },
    board(board: TaskBoard, userId: string, full: boolean, assignedOnly = false): TaskBoard {
      if (full && !assignedOnly) return board;
      return { ...board, scope: full ? "assigned" : "mine", tasks: board.tasks.filter((task) =>
        (!full && task.createdById === userId) || task.assignees.some((assignee) => assignee.kind === "user" && assignee.id === userId)) };
    },
    async detail(detail: TaskDetail, userId?: string): Promise<TaskDetail> {
      if (!userId) return detail;
      const visible = new Set(await repository.visibleIds(detail.projectId, detail.links.map((link) => link.targetTaskId), userId));
      return { ...detail, links: detail.links.filter((link) => visible.has(link.targetTaskId)) };
    },
  };
}
