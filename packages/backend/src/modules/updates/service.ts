import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { UpdatesRepository } from "./repository.ts";
import type {
  MediaItem,
  ProjectUpdate,
  UpdateAction,
  UpdateComment,
  UpdateCommentRow,
  UpdateMediaRow,
  UpdateRow,
  UpdateStatus,
} from "./types.ts";

const ALLOWED_TRANSITIONS: Record<string, UpdateStatus[]> = {
  Progress: ["Approved"],
  "Material Delivery": ["Inspected"],
  Inspections: ["Approved"],
  Issues: ["Resolved", "Escalated"],
};

export interface TransitionUpdateInput {
  status: UpdateStatus;
}

export interface AddCommentInput {
  body: string;
}

function toMedia(row: UpdateMediaRow): MediaItem {
  return { id: row.id, type: row.type, url: row.url };
}

function toAction(row: UpdateRow): UpdateAction {
  return {
    status: row.status,
    takenAt: row.action_taken_at ? new Date(row.action_taken_at).toISOString() : null,
    takenBy:
      row.action_taken_by_id && row.action_taken_by_name
        ? { id: row.action_taken_by_id, name: row.action_taken_by_name }
        : null,
  };
}

function toUpdate(row: UpdateRow, media: UpdateMediaRow[]): ProjectUpdate {
  const result: ProjectUpdate = {
    id: row.id,
    projectId: row.project_id,
    activityId: row.activity_id,
    author: {
      id: row.author_id,
      name: row.author_name,
      role: row.author_role,
      initialsTone: row.author_initials_tone,
      ...(row.author_avatar_url ? { avatarUrl: row.author_avatar_url } : {}),
    },
    category: row.category,
    title: row.title,
    description: row.description,
    media: media.map(toMedia),
    cta: { label: row.cta_label, tone: row.cta_tone },
    status: row.status,
    action: toAction(row),
    createdAt: new Date(row.created_at).toISOString(),
  };
  if (row.secondary_action_label) {
    result.secondaryAction = { label: row.secondary_action_label };
  }
  return result;
}

function toComment(row: UpdateCommentRow): UpdateComment {
  return {
    id: row.id,
    updateId: row.update_id,
    author: { id: row.author_id, name: row.author_name },
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function updatesService(repository: UpdatesRepository) {
  async function loadUpdate(
    projectId: string,
    updateId: string,
  ): Promise<UpdateRow> {
    const row = await repository.findById(updateId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Update");
    return row;
  }

  return {
    async listByProject(projectId: string): Promise<ProjectUpdate[]> {
      const rows = await repository.listByProject(projectId);
      if (rows.length === 0) return [];
      const media = await repository.mediaForUpdates(rows.map((r) => r.id));
      const grouped = new Map<string, UpdateMediaRow[]>();
      for (const m of media) {
        const list = grouped.get(m.update_id) ?? [];
        list.push(m);
        grouped.set(m.update_id, list);
      }
      return rows.map((row) => toUpdate(row, grouped.get(row.id) ?? []));
    },

    async transition(
      projectId: string,
      updateId: string,
      input: TransitionUpdateInput,
      actor: { id: string; name: string },
    ): Promise<ProjectUpdate> {
      const current = await loadUpdate(projectId, updateId);

      const allowed = ALLOWED_TRANSITIONS[current.category];
      if (!allowed || !allowed.includes(input.status)) {
        throw new BadRequestError(
          `Cannot transition ${current.category} update to ${input.status}`,
        );
      }
      if (current.status !== "Open") {
        throw new BadRequestError(
          `Update is already in status ${current.status}`,
        );
      }

      const updated = await repository.transitionStatus({
        updateId,
        status: input.status,
        actorId: actor.id,
        actorName: actor.name,
      });
      const media = await repository.mediaForUpdates([updated.id]);
      return toUpdate(updated, media);
    },

    async listComments(
      projectId: string,
      updateId: string,
    ): Promise<UpdateComment[]> {
      await loadUpdate(projectId, updateId);
      const rows = await repository.listComments(updateId);
      return rows.map(toComment);
    },

    async addComment(
      projectId: string,
      updateId: string,
      input: AddCommentInput,
      actor: { id: string; name: string },
    ): Promise<UpdateComment> {
      await loadUpdate(projectId, updateId);
      const row = await repository.addComment({
        id: generateId("comment"),
        update_id: updateId,
        author_id: actor.id,
        author_name: actor.name,
        body: input.body,
      });
      return toComment(row);
    },
  };
}

export type UpdatesService = ReturnType<typeof updatesService>;
