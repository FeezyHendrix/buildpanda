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
    /**
     * "Mine" must agree with applyTaskVisibility — created by me, assigned to
     * me, or assigned to my roster entry. The previous filter dropped created
     * tasks for full-board callers and every roster assignment, so a crew
     * member's own board arrived empty on devices that request scope=assigned.
     */
    async board(board: TaskBoard, userId: string, full: boolean, assignedOnly = false): Promise<TaskBoard> {
      const rosterIds = new Set(await repository.callerTeamMemberIds(board.projectId, userId));
      const isMine = (task: TaskBoard["tasks"][number]): boolean =>
        task.createdById === userId ||
        task.assignees.some((assignee) => assignee.kind === "user" ? assignee.id === userId : rosterIds.has(assignee.id));
      const tasks = board.tasks.map((task) => ({ ...task, mine: isMine(task) }));
      if (full && !assignedOnly) return { ...board, tasks };
      return { ...board, scope: full ? "assigned" : "mine", tasks: tasks.filter((task) => task.mine) };
    },
    async detail(detail: TaskDetail, userId?: string): Promise<TaskDetail> {
      if (!userId) return detail;
      const visible = new Set(await repository.visibleIds(detail.projectId, detail.links.map((link) => link.targetTaskId), userId));
      return { ...detail, links: detail.links.filter((link) => visible.has(link.targetTaskId)) };
    },
  };
}
