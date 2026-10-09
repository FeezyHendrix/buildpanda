import type { taskStageRepository } from "./stage-repository.ts";
import type { TaskBoard } from "./types.ts";

export function taskStageService(repository: ReturnType<typeof taskStageRepository>) {
  return {
    async filter(board: TaskBoard, stageId?: string): Promise<TaskBoard> {
      if (!stageId) return board;
      const ids = new Set(await repository.matchingIds(board.projectId, board.tasks.map((task) => task.id), stageId));
      return { ...board, tasks: board.tasks.filter((task) => ids.has(task.id)) };
    },
  };
}
