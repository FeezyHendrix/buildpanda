import { generateId } from "../../lib/ids.ts";
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors.ts";
import type { TasksRepository } from "./repository.ts";
import type { Subtask, TaskLink, TaskEntityLink, TaskEntityLinkRow, TaskEntityType } from "./types.ts";
import { toSubtask, toLink } from "./mappers.ts";
export function taskRelationsService(repository: TasksRepository, resolveEntityLinks: (rows: TaskEntityLinkRow[]) => Promise<TaskEntityLink[]>) {
  return {
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
